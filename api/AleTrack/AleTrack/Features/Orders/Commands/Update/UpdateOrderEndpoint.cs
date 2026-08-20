using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Common.Options;
using AleTrack.Entities;
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
    IOptions<CompanyOptions> companyOptions) : Endpoint<UpdateOrderRequest>
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

            // Only needed by the rebuild below. Kept inside the branch because it filters out
            // retired products, which would otherwise reject a notes-only save of an order
            // containing a since-retired one.
            var products = await GetExistingProductsAsync(req.Data.OrderItems, ct);

            // Both are optional patches: omitted means "leave as stored". They belong to the
            // shipment's lifecycle, and the order editor sends neither.
            order.ActualDeliveryDate = req.Data.ActualDeliveryDate ?? order.ActualDeliveryDate;
            order.State = req.Data.State ?? order.State;

            var addressChanged = await OrderDeliveryAddressWriter.ApplyAsync(
                dbContext, order, order.Client, req.Data.DeliveryAddressKind, req.Data.ClientDeliveryPlaceId, ct);

            if (addressChanged || clientChanged)
                await OrderDeliveryAddressWriter.PropagateToStopAsync(dbContext, order, DateTime.UtcNow, ct);

            // Destructive by design: the items are replaced, not merged, so every save hands
            // out fresh row IDs. outgoing_shipment_invoice_lines.order_item_id is Cascade, so
            // running this on a closed order deleted that order's invoice lines outright.
            // Skipping the rebuild — rather than rebuilding and then comparing — is what keeps
            // the rows, and the invoice lines hanging off them, alive.
            order.OrderItems.Clear();

            foreach (var orderItem in req.Data.OrderItems)
            {
                var relatedProduct = products.FirstOrDefault(p => p.PublicId == orderItem.ProductId);
                if (relatedProduct is null)
                    ThrowHelper.PublicEntityNotFound(nameof(Product), orderItem.ProductId);

                order.OrderItems.Add(new OrderItem
                {
                    Product = relatedProduct!,
                    Quantity = orderItem.Quantity,
                    ReminderState = orderItem.ReminderState
                });
            }
        }

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
        if (data.ClientId != order.Client.PublicId
            || (data.State is not null && data.State != order.State)
            || (data.ActualDeliveryDate is not null && data.ActualDeliveryDate != order.ActualDeliveryDate)
            || data.DeliveryAddressKind != order.DeliveryAddressKind
            || data.ClientDeliveryPlaceId != order.ClientDeliveryPlace?.PublicId)
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
    /// <see cref="OrderCustomExtraItem.IsShipmentLoadingConfirmed"/> is left alone —
    /// it belongs to the shipment, and an order edit must not un-confirm a loaded item.
    /// </summary>
    private static List<OrderCustomExtraItem> GetCustomExtras(List<OrderCustomExtraItemDto> extras, Order order)
    {
        var result = extras
            .Where(e => e.Id is null)
            .Select(e => new OrderCustomExtraItem { Description = e.Description, Quantity = e.Quantity, Note = e.Note })
            .ToList();

        foreach (var e in extras.Where(e => e.Id is not null && order.CustomExtraItems.Any(x => x.PublicId == e.Id!.Value)))
        {
            var existing = order.CustomExtraItems.First(x => x.PublicId == e.Id!.Value);
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