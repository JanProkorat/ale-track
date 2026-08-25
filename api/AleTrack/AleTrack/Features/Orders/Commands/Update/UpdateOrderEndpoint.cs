using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.Clients.Utils;
using AleTrack.Features.Orders.Utils;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Order = AleTrack.Entities.Order;

namespace AleTrack.Features.Orders.Commands.Update;

/// <summary>
/// Request to update existing order
/// </summary>
public sealed record UpdateOrderRequest
{
    /// <summary>
    /// Public ID of the order
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public UpdateOrderDto Data { get; set; } = null!;
}

/// <summary>
/// API endpoint for updating an existing order for delivery.
/// </summary>
/// <remarks>
/// Processes an HTTP PUT request to update the specified order's delivery date and state.
/// </remarks>
public sealed class UpdateOrderEndpoint(
    AleTrackDbContext dbContext,
    IOptions<CompanyOptions> companyOptions,
    IAppContext appContext) : Endpoint<UpdateOrderRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("orders/{id}");
        Description(b => b
            .RequirePermission(ModuleType.Orders, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(UpdateOrderEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates order for delivery";
                s.Responses[StatusCodes.Status204NoContent] = "Order updated";
                s.Responses[StatusCodes.Status400BadRequest] = "Order is closed or already loaded; its content is frozen";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateOrderRequest req, CancellationToken ct)
    {
        var order = await dbContext.Orders
            .Where(o => o.PublicId == req.Id)
            .Include(o => o.Client)
            .Include(o => o.ClientDeliveryPlace)
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
            .Include(o => o.Returns)
            .Include(o => o.Notes)
            .Include(o => o.CustomExtraItems)
            .Include(o => o.SupplierGoodItems)
                .ThenInclude(i => i.SupplierGood)
            // The freeze follows the shipment carrying the order, not only the order's own
            // state — order items are the shipment's content.
            .Include(o => o.OutgoingShipmentStop)
                .ThenInclude(s => s!.OutgoingShipment)
                    // The rows the office has marked finished: a change to what is billed here
                    // has to un-mark the one covering this order — see UnmarkInvoicingAsync.
                    .ThenInclude(sh => sh.InvoiceConfirmations)
            .FirstOrDefaultAsync(ct);

        if (order is null)
            ThrowHelper.PublicEntityNotFound(nameof(Order), req.Id);

        var contentEditable = OrderMutability.IsContentEditable(order!);

        if (!contentEditable && RequestChangesFrozenContent(order!, req.Data))
            ThrowHelper.OrderContentFrozen(req.Id);

        // Captured before the possible reassignment below: changing the
        // client implies changing the address (the old place belongs to the
        // old client), so it must feed into the propagation decision even
        // when the (kind, placeId) pair itself is left untouched.
        var clientChanged = req.Data.ClientId != order!.Client.PublicId;

        // Read before anything is applied, and remembered across the save: a marked invoice row
        // says somebody checked this order against the paperwork, so changing what is billed has
        // to send it back for checking. The payer is captured too, because changing the client
        // moves the order to a different row.
        var billedContentChanged = RequestChangesBilledContent(order, req.Data);
        var payerBefore = InvoiceReadiness.RowClientIdOf(order);

        order.RequiredDeliveryDate = req.Data.RequiredDeliveryDate;

        if (contentEditable)
        {
            if (clientChanged)
            {
                var client = await dbContext.Clients.FirstOrDefaultAsync(c => c.PublicId == req.Data.ClientId, ct);
                if (client == null)
                    ThrowHelper.PublicEntityNotFound(nameof(Client), req.Data.ClientId);

                order.Client = client!;
            }

            // Only needed by the merge below, for the lines it has to create. Kept inside the
            // branch because it filters out retired products, which would otherwise reject a
            // notes-only save of an order containing a since-retired one.
            var products = await GetExistingProductsAsync(req.Data.OrderItems, ct);

            // Both are optional patches: omitted means "leave as stored". They belong to the
            // shipment's lifecycle, and the order editor sends neither.
            order.ActualDeliveryDate = req.Data.ActualDeliveryDate ?? order.ActualDeliveryDate;
            order.State = req.Data.State ?? order.State;

            MergeOrderItems(req.Data.OrderItems, order, products);
        }

        await ApplyDeliveryAddressAsync(req.Data, order, clientChanged, ct);

        if (billedContentChanged)
            UnmarkInvoicing(order, payerBefore);

        // Which of the client's open points this order promises to settle. Outside the freeze
        // gate: it records an intention about the ledger, not the order's content, and the
        // entries close only when the order is delivered.
        await ClientLedgerAssignment.AssignAsync(dbContext, order, req.Data.SettledLedgerEntryIds, ct);

        // Cancelling the order withdraws every promise it was carrying, so those points go back
        // to being open. Cancelling the *shipment* deliberately does not — that only frees the
        // order for re-planning, and it still carries the debt.
        if (order.State is OrderState.Cancelled)
            await ClientLedgerAssignment.ReleaseForCancelledOrderAsync(dbContext, order.Id, ct);

        order.Returns = GetReturns(req.Data.Returns, order);
        order.Notes = GetNotes(req.Data.Notes, order);
        order.CustomExtraItems = GetCustomExtras(req.Data.CustomExtraItems, order);
        order.SupplierGoodItems = await GetSupplierGoodItemsAsync(req.Data.SupplierGoodItems, order, ct);
        ApplyItemNotes(req.Data.OrderItems, order);

        // After the lines are settled, before the save: a supplier good added to (or dropped
        // from) an order already sitting on a planned run changes which pickup stops that run
        // needs, and nothing else would tell it.
        await PickupStopSync.ForOrderAsync(dbContext, order.PublicId, companyOptions.Value, ct);

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Applies the requested delivery address and pushes it onto the order's stop.
    /// </summary>
    /// <remarks>
    /// Its own pass outside the <c>contentEditable</c> branch, like <see cref="ApplyItemNotes"/>,
    /// and deliberately absent from <see cref="RequestChangesFrozenContent"/>. What freezes when
    /// the truck is packed is what is on it; where a client takes delivery is something that
    /// client can still change afterwards — ringing mid-run to say they cannot make it to the
    /// agreed address is the commonest deviation there is. Refusing it left the dispatcher with
    /// nowhere to record what happened, so the move is allowed and
    /// <see cref="OrderDeliveryAddressWriter.PropagateToStopAsync"/> writes it into the client's
    /// ledger.
    ///
    /// A closed order is still excluded: moving a delivery that has already happened would be
    /// rewriting history rather than recording it. The stop's own guard refuses a delivered or
    /// cancelled run for the same reason.
    /// </remarks>
    private async Task ApplyDeliveryAddressAsync(
        UpdateOrderDto data, Order order, bool clientChanged, CancellationToken ct)
    {
        if (order.State is OrderState.Finished or OrderState.Cancelled)
            return;

        var addressChanged = await OrderDeliveryAddressWriter.ApplyAsync(
            dbContext, order, order.Client, data.DeliveryAddressKind, data.ClientDeliveryPlaceId, ct);

        if (!addressChanged && !clientChanged)
            return;

        // The author is passed through because propagation may record a change of destination in
        // the client's ledger, and who moved a delivery is worth knowing.
        var userId = await ResolveCurrentUserIdAsync(ct);
        await OrderDeliveryAddressWriter.PropagateToStopAsync(dbContext, order, DateTime.UtcNow, ct, userId);
    }

    /// <summary>
    /// Whether the request changes anything the invoice bills for.
    /// </summary>
    /// <remarks>
    /// Narrower than <see cref="RequestChangesFrozenContent"/> on purpose. A reminder flag or a
    /// note is not on an invoice, and neither is the delivered date; sending a marked row back
    /// for checking over one of those would teach the office to ignore the mark. Returns are out
    /// for the same reason — empties are deposits, not billed pieces.
    ///
    /// Supplier goods and custom extras are in, unlike in the freeze predicate: they are lines of
    /// the invoice, so a changed quantity there is exactly what somebody has to re-check.
    /// </remarks>
    private static bool RequestChangesBilledContent(Order order, UpdateOrderDto data)
    {
        if (data.ClientId != order.Client.PublicId)
            return true;

        var storedItems = order.OrderItems
            .Select(i => (i.Product.PublicId, i.Quantity))
            .OrderBy(i => i.PublicId).ThenBy(i => i.Quantity)
            .ToList();

        var incomingItems = data.OrderItems
            .Select(i => (PublicId: i.ProductId, i.Quantity))
            .OrderBy(i => i.PublicId).ThenBy(i => i.Quantity)
            .ToList();

        if (!storedItems.SequenceEqual(incomingItems))
            return true;

        var storedGoods = order.SupplierGoodItems
            .Where(g => g.SupplierGood is not null)
            .Select(g => (g.SupplierGood!.PublicId, g.Quantity))
            .OrderBy(g => g.PublicId).ThenBy(g => g.Quantity)
            .ToList();

        var incomingGoods = (data.SupplierGoodItems ?? [])
            .Select(g => (PublicId: g.SupplierGoodId, g.Quantity))
            .OrderBy(g => g.PublicId).ThenBy(g => g.Quantity)
            .ToList();

        if (!storedGoods.SequenceEqual(incomingGoods))
            return true;

        var storedExtras = order.CustomExtraItems
            .Select(e => (e.Description, e.Quantity))
            .OrderBy(e => e.Description).ThenBy(e => e.Quantity)
            .ToList();

        var incomingExtras = (data.CustomExtraItems ?? [])
            .Select(e => (e.Description, e.Quantity))
            .OrderBy(e => e.Description).ThenBy(e => e.Quantity)
            .ToList();

        return !storedExtras.SequenceEqual(incomingExtras);
    }

    /// <summary>
    /// Sends the invoice row covering this order back for checking.
    /// </summary>
    /// <remarks>
    /// The number is kept, exactly as un-marking by hand keeps it — re-marking then gives the
    /// same one back and no number is ever printed against two clients.
    ///
    /// Both payers when the client moved: the row the order used to sit on has to lose its mark
    /// too, because what it was checked against has left it. A filed run is left alone — nothing
    /// there can be edited anyway, and the marks are the record of what was filed.
    /// </remarks>
    private static void UnmarkInvoicing(Order order, long payerBefore)
    {
        var shipment = order.OutgoingShipmentStop?.OutgoingShipment;

        if (shipment is null || shipment.IsInvoicingFiled)
            return;

        // The payer read off the navigation, not off the FK: the client may have been reassigned a
        // moment ago and the key still points at the old one until EF fixes it up, which would
        // leave the new row marked as checked against goods that have only just arrived on it.
        var payerAfter = order.Client.InvoicingClientId ?? order.Client.Id;
        var payers = new[] { payerBefore, payerAfter };

        foreach (var confirmation in shipment.InvoiceConfirmations.Where(c => payers.Contains(c.ClientId)))
            confirmation.IsReady = false;
    }

    /// <summary>
    /// Whether the request would actually change content that is frozen.
    /// </summary>
    /// <remarks>
    /// Comparing rather than blanket-rejecting keeps the full-object PUT working: the order
    /// screen re-sends everything, so a notes-only save on a delivered order still succeeds.
    /// </remarks>
    private static bool RequestChangesFrozenContent(Order order, UpdateOrderDto data)
    {
        // State and ActualDeliveryDate are compared only when the request carries them:
        // omitted means "leave as stored", which is by definition not a change.
        //
        // The delivery address is deliberately not compared — see ApplyDeliveryAddressAsync,
        // which writes it in its own pass. Changing the *client*, on the other hand, still is
        // frozen content: that is not a client moving their own delivery, it is a different
        // client's goods on a packed truck.
        if (data.ClientId != order.Client.PublicId
            || (data.State is not null && data.State != order.State)
            || (data.ActualDeliveryDate is not null && data.ActualDeliveryDate != order.ActualDeliveryDate))
            return true;

        var storedItems = order.OrderItems
            .Select(i => (i.Product.PublicId, i.Quantity, i.ReminderState))
            .OrderBy(i => i.PublicId)
            .ThenBy(i => i.Quantity)
            .ToList();

        var incomingItems = data.OrderItems
            .Select(i => (PublicId: i.ProductId, i.Quantity, i.ReminderState))
            .OrderBy(i => i.PublicId)
            .ThenBy(i => i.Quantity)
            .ToList();

        return !storedItems.SequenceEqual(incomingItems);
    }

    /// <summary>
    /// Merges the posted item lines into the persisted ones, pairing them on the product.
    /// </summary>
    /// <remarks>
    /// Rebuilding the collection handed out fresh row IDs on every save, and
    /// <see cref="OrderItem"/> carries three fields the order does not own —
    /// <see cref="OrderItem.IsShipmentLoadingConfirmed"/>, ticked off while packing, plus
    /// <see cref="OrderItem.QuantityFromInventory"/> and
    /// <see cref="OrderItem.InventoryItemId"/>, set when the sourcing is split. All three sit
    /// on a shipment still in <c>Created</c>, which is exactly when the order is also still
    /// editable, so any save reset them silently. The new row also took the old one's invoice
    /// line with it, <c>outgoing_shipment_invoice_lines.order_item_id</c> being Cascade.
    ///
    /// Pairing on the product is safe for the same reason <see cref="ApplyItemNotes"/> relies
    /// on: the order editor increments an existing cart line rather than adding a second one
    /// for the same product, so a product appears at most once.
    ///
    /// A line the save leaves out is still removed, and its invoice line still cascades away —
    /// merging is about the lines that stay, not about never deleting one.
    /// </remarks>
    private static void MergeOrderItems(List<UpdateOrderItemDto> posted, Order order, List<Product> products)
    {
        var dropped = order.OrderItems
            .Where(stored => posted.All(p => p.ProductId != stored.Product.PublicId))
            .ToList();

        foreach (var stored in dropped)
            order.OrderItems.Remove(stored);

        foreach (var line in posted)
        {
            var existing = order.OrderItems.FirstOrDefault(i => i.Product.PublicId == line.ProductId);

            if (existing is not null)
            {
                // A ticked-off line whose count changes has not been checked at that count. The
                // tick says somebody counted these pieces into the van; leaving it standing would
                // have the ramp trust a number nobody read.
                if (existing.Quantity != line.Quantity)
                    existing.IsShipmentLoadingConfirmed = false;

                existing.Quantity = line.Quantity;
                existing.ReminderState = line.ReminderState;

                // Clamped, not re-seeded, exactly as GetSupplierGoodItemsAsync treats the
                // garage split: the sourcing is a decision somebody made on the shipment, and
                // cutting the ordered quantity is no reason to throw it away.
                existing.QuantityFromInventory =
                    SupplierGoodSourcing.Clamp(existing.QuantityFromInventory, line.Quantity);

                // Nothing left to source means nothing left to source it from — the stock link
                // is documented as null whenever no pieces come out of inventory.
                if (existing.QuantityFromInventory == 0)
                {
                    existing.InventoryItem = null;
                    existing.InventoryItemId = null;
                }

                continue;
            }

            var relatedProduct = products.FirstOrDefault(p => p.PublicId == line.ProductId);
            if (relatedProduct is null)
                ThrowHelper.PublicEntityNotFound(nameof(Product), line.ProductId);

            order.OrderItems.Add(new OrderItem
            {
                Product = relatedProduct!,
                Quantity = line.Quantity,
                ReminderState = line.ReminderState
            });
        }
    }

    /// <summary>
    /// Diffs the posted returns against the persisted ones: rows without an ID are
    /// new, rows matching a persisted <see cref="OrderReturn.PublicId"/> are updated
    /// in place (keeping their ID stable), and anything left out is dropped.
    /// </summary>
    private static List<OrderReturn> GetReturns(List<OrderReturnDto> returns, Order order)
    {
        var result = returns
            .Where(r => r.Id is null)
            .Select(r => new OrderReturn { Name = r.Name, Quantity = r.Quantity, Note = r.Note })
            .ToList();

        foreach (var r in returns.Where(r => r.Id is not null && order.Returns.Any(x => x.PublicId == r.Id!.Value)))
        {
            var existing = order.Returns.First(x => x.PublicId == r.Id!.Value);
            existing.Name = r.Name;
            existing.Quantity = r.Quantity;
            existing.Note = r.Note;
            result.Add(existing);
        }

        return result;
    }

    /// <summary>
    /// Diffs the posted notes against the persisted ones, the same way as returns.
    /// <see cref="OrderNote.DateCreated"/> is server-owned: kept as-is on an
    /// existing note, stamped now on a new one.
    /// </summary>
    private static List<OrderNote> GetNotes(List<OrderNoteDto> notes, Order order)
    {
        var result = notes
            .Where(n => n.Id is null)
            .Select(n => new OrderNote { Text = n.Text, DateCreated = DateTime.UtcNow })
            .ToList();

        foreach (var n in notes.Where(n => n.Id is not null && order.Notes.Any(x => x.PublicId == n.Id!.Value)))
        {
            var existing = order.Notes.First(x => x.PublicId == n.Id!.Value);
            existing.Text = n.Text;
            result.Add(existing);
        }

        return result;
    }

    /// <summary>
    /// Diffs posted custom extras against the persisted ones, like returns and notes.
    /// </summary>
    /// <remarks>
    /// <see cref="OrderCustomExtraItem.IsShipmentLoadingConfirmed"/> survives an edit that leaves
    /// the count alone — renaming a line or adding a note does not un-check what was counted into
    /// the van. A changed count does clear it: the tick says somebody counted these pieces, and at
    /// a different number nobody has.
    /// </remarks>
    private static List<OrderCustomExtraItem> GetCustomExtras(List<OrderCustomExtraItemDto> extras, Order order)
    {
        var result = extras
            .Where(e => e.Id is null)
            .Select(e => new OrderCustomExtraItem { Description = e.Description, Quantity = e.Quantity, Note = e.Note })
            .ToList();

        foreach (var e in extras.Where(e => e.Id is not null && order.CustomExtraItems.Any(x => x.PublicId == e.Id!.Value)))
        {
            var existing = order.CustomExtraItems.First(x => x.PublicId == e.Id!.Value);

            if (existing.Quantity != e.Quantity)
                existing.IsShipmentLoadingConfirmed = false;

            existing.Description = e.Description;
            existing.Quantity = e.Quantity;
            existing.Note = e.Note;
            result.Add(existing);
        }

        return result;
    }

    /// <summary>
    /// Diffs posted supplier-good lines against the persisted ones, like the custom extras.
    /// </summary>
    /// <remarks>
    /// Merged rather than rebuilt, and deliberately outside the <c>contentEditable</c> branch
    /// and <see cref="RequestChangesFrozenContent"/> — the same treatment custom extras get.
    /// These lines are not part of the shipment's frozen content: they never reach the
    /// nakládka or the content snapshot, so there is nothing a late edit could contradict.
    /// </remarks>
    private async Task<List<OrderSupplierGoodItem>> GetSupplierGoodItemsAsync(
        List<OrderSupplierGoodItemDto> items, Order order, CancellationToken ct)
    {
        var newRows = items.Where(i => i.Id is null).ToList();

        var goodIds = newRows.Select(i => i.SupplierGoodId).ToList();
        var goods = goodIds.Count > 0
            ? await dbContext.SupplierGoods.Where(g => goodIds.Contains(g.PublicId)).ToListAsync(ct)
            : [];

        var result = new List<OrderSupplierGoodItem>();

        foreach (var i in newRows)
        {
            var good = goods.FirstOrDefault(g => g.PublicId == i.SupplierGoodId);
            if (good is null)
                ThrowHelper.PublicEntityNotFound(nameof(SupplierGood), i.SupplierGoodId);

            result.Add(new OrderSupplierGoodItem
            {
                SupplierGood = good!,
                Quantity = i.Quantity,
                Note = i.Note,
                QuantityFromGarage = SupplierGoodSourcing.DefaultFromGarage(good!, i.Quantity)
            });
        }

        // An existing row keeps its identity and its good; only the quantity and note are
        // patchable. Swapping the good on a line would be indistinguishable from removing
        // one line and adding another, which is what the editor actually does.
        foreach (var i in items.Where(i => i.Id is not null && order.SupplierGoodItems.Any(x => x.PublicId == i.Id!.Value)))
        {
            var existing = order.SupplierGoodItems.First(x => x.PublicId == i.Id!.Value);
            existing.Quantity = i.Quantity;
            existing.Note = i.Note;
            // Clamped, not re-seeded: the split is a decision somebody made on the shipment,
            // and cutting the quantity is no reason to throw it away.
            existing.QuantityFromGarage = SupplierGoodSourcing.Clamp(existing.QuantityFromGarage, i.Quantity);
            result.Add(existing);
        }

        return result;
    }

    /// <summary>
    /// Copies each posted line's note onto the persisted <see cref="OrderItem"/> for the same
    /// product.
    /// </summary>
    /// <remarks>
    /// Deliberately outside the item rebuild above, and deliberately absent from
    /// <see cref="RequestChangesFrozenContent"/>. That comparison exists so an unchanged PUT
    /// skips the destructive rebuild and leaves the rows — and the invoice lines cascading off
    /// them — alive; a note-only save therefore never reaches the rebuild at all. Counting the
    /// note as frozen content would fix that by re-entering the rebuild, at the cost of
    /// deleting invoice lines for the sake of a note.
    ///
    /// So notes are written here instead: on every save, at every order state. They instruct
    /// rather than describe — what to do with a line, not what is on the truck — and are most
    /// useful precisely once the shipment is packed and the loader is looking at it.
    ///
    /// Matching on the product is safe: the order editor increments an existing cart line
    /// rather than adding a second one for the same product, so a product appears at most
    /// once. A posted line whose product is not on the order is ignored — adding and removing
    /// items belongs to the rebuild.
    /// </remarks>
    private static void ApplyItemNotes(List<UpdateOrderItemDto> items, Order order)
    {
        foreach (var item in order.OrderItems)
        {
            var posted = items.FirstOrDefault(i => i.ProductId == item.Product.PublicId);
            if (posted is not null)
            {
                item.Note = posted.Note;
            }
        }
    }

    private async Task<long?> ResolveCurrentUserIdAsync(CancellationToken ct)
    {
        if (appContext.UserId is null)
            return null;

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.PublicId == appContext.UserId, ct);

        return user?.Id;
    }

    private async Task<List<Product>> GetExistingProductsAsync(List<UpdateOrderItemDto> orderItems, CancellationToken ct)
    {
        var productIds = orderItems
            .Select(i => i.ProductId)
            .ToList();

        // Retired products are excluded, so adding one reports it as not found. Only
        // reached on an editable order — a frozen order never rebuilds its items.
        return await dbContext.Products
            .Where(p => productIds.Contains(p.PublicId) && !p.IsDeleted)
            .ToListAsync(ct);
    }
}