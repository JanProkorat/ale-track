using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Clients.Utils;
using AleTrack.Features.Orders.Utils;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Everything that happens when a shipment changes state: the readiness guards, the orders
/// riding along, the stock the run draws and returns, and the price snapshot.
/// </summary>
/// <remarks>
/// Extracted so the full-object PUT and the dedicated <c>PUT .../state</c> endpoint drive the
/// same transition. Two copies of this would drift, and the drift would be silent — a run that
/// took stock out through one endpoint and never put it back through the other.
/// </remarks>
public static class ShipmentStateTransition
{
    /// <summary>
    /// Whether a shipment in <paramref name="state"/> has already taken its inventory-sourced
    /// pieces out of stock.
    /// </summary>
    /// <remarks>
    /// Derived rather than stored, and sound because the draw happens on exactly one edge — into
    /// <see cref="OutgoingShipmentState.Loaded"/> — and <see cref="ApplyAsync"/> puts the pieces
    /// back on every edge out of the drawn set. Delivered is terminal and keeps them: those goods
    /// really did leave the shelf.
    ///
    /// The nakládka's over-draw warning keys off this too: once the pieces are out, the on-hand
    /// figure no longer contains them, so comparing the draw against it would flag every loaded
    /// run as over-drawn.
    /// </remarks>
    public static bool IsStockDrawn(OutgoingShipmentState state) =>
        state is OutgoingShipmentState.Loaded
            or OutgoingShipmentState.InTransit
            or OutgoingShipmentState.Delivered;

    /// <summary>
    /// Rejects a move the lifecycle does not allow.
    /// </summary>
    public static void EnsureAllowed(OutgoingShipment shipment, OutgoingShipmentState next)
    {
        if (!ShipmentMutability.IsTransitionAllowed(shipment.State, next))
            ThrowHelper.ShipmentTransitionNotAllowed(shipment.State, next);
    }

    /// <summary>
    /// Rejects a move the shipment is not yet equipped for: nothing to load, or a run sent out
    /// without a date, a van, a driver or a stop.
    /// </summary>
    /// <remarks>
    /// Reads the shipment's assembled content, so callers that rebuild that content must call
    /// this after the rebuild — otherwise it judges the stored run rather than the requested one.
    /// </remarks>
    public static void EnsureReady(OutgoingShipment shipment, OutgoingShipmentState next)
    {
        if (next is OutgoingShipmentState.Loaded && shipment.Stops.Count == 0)
            ThrowHelper.ShipmentCannotBeLoadedWithoutStops();

        // Nakládka is pieces going into one particular van: the loading list is checked off
        // against its capacity, and the state freezes the run's content as loaded. Neither means
        // anything without knowing which vehicle it was loaded into. The driver and the date are
        // not required here — they are what leaving needs, which is the check below.
        // The navigation as well as the key: the full PUT can assign a van and ask for Loaded in
        // one request, and EF fills the foreign key only on save — reading the key alone would
        // reject the very request that supplies the van.
        if (next is OutgoingShipmentState.Loaded
            && shipment.VehicleId is null && shipment.Vehicle is null)
            ThrowHelper.ShipmentCannotBeLoadedWithoutVehicle();

        if (next is OutgoingShipmentState.Delivered or OutgoingShipmentState.InTransit
            && !shipment.HasFilledData)
            ThrowHelper.ShipmentNotPrepared(next);
    }

    /// <summary>
    /// Moves the shipment to <paramref name="next"/> and applies every consequence of the move.
    /// </summary>
    /// <remarks>
    /// Assigns the state itself, because every decision below is a comparison of the stored state
    /// against the requested one. Callers must therefore not have assigned it already.
    ///
    /// Does not save — the caller owns the transaction.
    /// </remarks>
    public static async Task ApplyAsync(
        AleTrackDbContext dbContext,
        OutgoingShipment shipment,
        OutgoingShipmentState next,
        CancellationToken ct)
    {
        var previous = shipment.State;

        var isDrawingStock = !IsStockDrawn(previous) && IsStockDrawn(next);
        var isReturningStock = IsStockDrawn(previous) && !IsStockDrawn(next);
        var isEnteringLoaded = previous != OutgoingShipmentState.Loaded && next == OutgoingShipmentState.Loaded;
        var isRevertingToCreated = previous != OutgoingShipmentState.Created && next == OutgoingShipmentState.Created;
        var isTransitioningToDelivered = previous != OutgoingShipmentState.Delivered
                                         && next == OutgoingShipmentState.Delivered;
        // A round that is being taken back: the stops the drivers reported as done did not happen,
        // or are about to happen again. Loaded and Cancelled are the only two ways off the road
        // that are not Delivered (see ShipmentMutability.IsTransitionAllowed).
        var isLeavingTheRoad = previous == OutgoingShipmentState.InTransit
                               && next is OutgoingShipmentState.Loaded or OutgoingShipmentState.Cancelled;

        shipment.State = next;

        ApplyToOrders(shipment, next);

        // Delivered is where an order settles the deviations it was carrying. Hooked to the same
        // edge that turns its orders Finished, so "the debt is closed" cannot drift away from
        // "the goods arrived".
        if (isTransitioningToDelivered)
        {
            var deliveredOrders = shipment.Stops
                .Where(s => s.ClientOrder is not null)
                .Select(s => s.ClientOrder!)
                .ToList();

            await ClientLedgerAssignment.SettleForDeliveredOrdersAsync(dbContext, deliveredOrders, DateTime.UtcNow, ct);
        }

        // Before the reset below, which zeroes the very quantities the return reads.
        if (isReturningStock)
            ReturnToInventory(shipment);

        if (next == OutgoingShipmentState.Cancelled)
            ResetOrderItemsForReuse(shipment);

        if (isDrawingStock)
            SubtractFromInventory(shipment);

        // Snapshot at the same boundary that freezes content, so the two cannot diverge. The
        // reports read nothing else from here on.
        if (isEnteringLoaded)
            await WriteSnapshotAsync(dbContext, shipment, ct);

        // Reverting reopens the content for editing, so a kept snapshot would go stale. It is
        // rebuilt on the next transition into Loaded.
        if (isRevertingToCreated)
            ShipmentContentSnapshotWriter.Clear(shipment);

        // The per-stop "finished" marks are notes about one journey. Keeping them across a revert
        // would start the next attempt with stops already ticked off, which is worse than losing
        // what was only ever a progress note.
        if (isLeavingTheRoad)
        {
            foreach (var stop in shipment.Stops)
                stop.CompletedAt = null;
        }

        if (isTransitioningToDelivered && shipment.StockPurchases.Count > 0)
            await AddStockPurchasesToInventoryAsync(dbContext, shipment.StockPurchases, ct);
    }

    /// <summary>
    /// Orders follow the shipment carrying them: added → Planning, in transit → Delivering,
    /// delivered → Finished (+ the actual delivery date), cancelled → back to New for reuse.
    /// </summary>
    private static void ApplyToOrders(OutgoingShipment shipment, OutgoingShipmentState next)
    {
        foreach (var order in shipment.Stops.Where(s => s.ClientOrder is not null).Select(s => s.ClientOrder!))
        {
            switch (next)
            {
                case OutgoingShipmentState.Cancelled:
                    order.State = OrderState.New;
                    break;
                case OutgoingShipmentState.Delivered:
                    order.State = OrderState.Finished;
                    order.ActualDeliveryDate ??= DateOnly.FromDateTime(DateTime.UtcNow);
                    break;
                case OutgoingShipmentState.InTransit:
                    order.State = OrderState.Delivering;
                    break;
                default: // Created / Loaded
                    // New orders enter planning; reverting a shipment from InTransit
                    // back to Loaded pulls its orders out of Delivering too.
                    if (order.State is OrderState.New or OrderState.Delivering)
                        order.State = OrderState.Planning;
                    break;
            }
        }
    }

    /// <summary>
    /// Takes the inventory-sourced pieces of each order item out of stock. Runs on the
    /// transition to Loaded — stock is consumed when the truck is packed.
    /// </summary>
    /// <remarks>
    /// Stock is allowed to go negative: the depot may knowingly load against a delivery
    /// that has not been booked in yet, and the nakládka warns about it rather than
    /// blocking the load.
    /// </remarks>
    private static void SubtractFromInventory(OutgoingShipment shipment)
    {
        foreach (var item in DrawnItems(shipment))
            item.InventoryItem!.Quantity -= item.QuantityFromInventory;

        foreach (var good in DrawnSupplierGoods(shipment))
            good.SupplierGood.InventoryItem!.Quantity -= good.QuantityFromGarage;
    }

    /// <summary>
    /// Puts the drawn pieces back when a run is unpacked — reverted to Created, or cancelled.
    /// </summary>
    /// <remarks>
    /// The counterpart to <see cref="SubtractFromInventory"/>, and the reason the draw is safe to
    /// repeat: without it, Created → Loaded → Created → Loaded subtracted twice, and the stock
    /// figure drifted down by the sourced quantity on every round trip.
    /// </remarks>
    private static void ReturnToInventory(OutgoingShipment shipment)
    {
        foreach (var item in DrawnItems(shipment))
            item.InventoryItem!.Quantity += item.QuantityFromInventory;

        foreach (var good in DrawnSupplierGoods(shipment))
            good.SupplierGood.InventoryItem!.Quantity += good.QuantityFromGarage;
    }

    /// <summary>Order items whose pieces come out of a known stock entry.</summary>
    private static IEnumerable<OrderItem> DrawnItems(OutgoingShipment shipment) =>
        shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .SelectMany(s => s.ClientOrder!.OrderItems)
            .Where(i => i.QuantityFromInventory > 0 && i.InventoryItem is not null);

    /// <summary>
    /// Supplier-good lines whose garage-sourced pieces come out of a known stock entry.
    /// </summary>
    /// <remarks>
    /// A good with no stock row is skipped rather than treated as zero stock: it means nobody
    /// has ever booked one in through a dovoz, and inventing a row here would put a negative
    /// count on something the warehouse does not track.
    /// </remarks>
    private static IEnumerable<OrderSupplierGoodItem> DrawnSupplierGoods(OutgoingShipment shipment) =>
        shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .SelectMany(s => s.ClientOrder!.SupplierGoodItems)
            .Where(i => i.QuantityFromGarage > 0
                        && i.SupplierGood is not null
                        && i.SupplierGood.InventoryItem is not null);

    /// <summary>
    /// Clears the shipment-scoped fields on a freed order so it can be planned onto
    /// another loading.
    /// </summary>
    public static void ResetOrderItemsForReuse(OutgoingShipment shipment)
    {
        foreach (var stop in shipment.Stops.Where(s => s.ClientOrder is not null))
        {
            foreach (var orderItem in stop.ClientOrder!.OrderItems)
            {
                orderItem.IsShipmentLoadingConfirmed = false;
                orderItem.QuantityFromInventory = 0;
                orderItem.InventoryItem = null;
                orderItem.InventoryItemId = null;
            }

            foreach (var extra in stop.ClientOrder.CustomExtraItems)
                extra.IsShipmentLoadingConfirmed = false;

            // Back to the good's own default rather than to zero: the split was this run's
            // decision about where to fetch from, and the standing arrangement with the
            // supplier is what the next run should start from.
            foreach (var good in stop.ClientOrder.SupplierGoodItems.Where(g => g.SupplierGood is not null))
                good.QuantityFromGarage = SupplierGoodSourcing.DefaultFromGarage(good.SupplierGood, good.Quantity);
        }
    }

    /// <summary>
    /// Freezes what each client is billed for, at the prices in force the moment the truck
    /// is packed.
    /// </summary>
    private static async Task WriteSnapshotAsync(
        AleTrackDbContext dbContext, OutgoingShipment shipment, CancellationToken ct)
    {
        var clientIds = shipment.Stops
            .Where(s => s.ClientOrder?.Client is not null)
            .Select(s => s.ClientOrder!.Client!.Id)
            .Distinct()
            .ToList();

        var priceRows = clientIds.Count == 0
            ? []
            : await dbContext.ClientProductPrices
                .AsNoTracking()
                .Where(p => clientIds.Contains(p.ClientId))
                .Select(p => new { p.ClientId, p.ProductId, p.PriceWithVat })
                .ToListAsync(ct);

        var priceListsByClientId = priceRows
            .GroupBy(p => p.ClientId)
            .ToDictionary(
                g => g.Key,
                g => new ClientPriceList(g.ToDictionary(p => p.ProductId, p => p.PriceWithVat)));

        ShipmentContentSnapshotWriter.Apply(shipment, priceListsByClientId);
    }

    /// <summary>
    /// Books the run's "Zboží na sklad" purchases into inventory on delivery.
    /// </summary>
    private static async Task AddStockPurchasesToInventoryAsync(
        AleTrackDbContext dbContext,
        ICollection<OutgoingShipmentStockPurchaseItem> stockPurchases,
        CancellationToken ct)
    {
        var productIds = stockPurchases
            .Select(ei => ei.Product.Id)
            .ToList();

        var existingInventory = await dbContext.InventoryItems
            .Where(i => i.ProductId != null && productIds.Contains(i.ProductId.Value))
            .ToListAsync(ct);

        var inventoryByProductId = existingInventory.ToDictionary(i => i.ProductId!.Value);

        var newInventoryItems = new List<InventoryItem>();
        foreach (var item in stockPurchases)
        {
            if (inventoryByProductId.TryGetValue(item.Product.Id, out var existing))
                existing.Quantity += item.Quantity;
            else
                newInventoryItems.Add(new InventoryItem
                {
                    PublicId = Guid.NewGuid(),
                    ProductId = item.Product.Id,
                    Quantity = item.Quantity
                });
        }

        if (newInventoryItems.Count > 0)
            dbContext.InventoryItems.AddRange(newInventoryItems);
    }
}
