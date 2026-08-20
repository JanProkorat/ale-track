using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Re-derives the pickup stops of whichever run carries a given order, after that order's
/// content changed.
/// </summary>
/// <remarks>
/// The shipment write paths reconcile their own stops, which covers planning an order onto a
/// run. This covers the other direction: an order already on a planned run gaining (or losing)
/// a supplier good. Without it the run would keep the stops it needed at save time and never
/// learn about the change — the same staleness
/// <see cref="Orders.Utils.OrderDeliveryAddressWriter.PropagateToStopAsync"/> exists to avoid
/// for the delivery address.
/// </remarks>
public static class PickupStopSync
{
    /// <summary>
    /// Reloads the run carrying <paramref name="orderPublicId"/> and re-applies both pickup
    /// reconcilers to it. Does nothing when the order is not on a run, or when that run's
    /// content is already frozen.
    /// </summary>
    public static async Task ForOrderAsync(
        AleTrackDbContext dbContext,
        Guid orderPublicId,
        CompanyOptions company,
        CancellationToken ct)
    {
        // Loaded whole rather than reached through the stop: both reconcilers read every stop
        // on the run and every supplier-good line behind them, so a stop-shaped query would
        // see one order and strip the stops the others still need.
        var shipment = await dbContext.OutgoingShipments
            .Include(os => os.StockPurchases)
            .Include(os => os.Stops)
                .ThenInclude(s => s.ClientOrder!)
                    .ThenInclude(o => o.SupplierGoodItems)
                        .ThenInclude(i => i.SupplierGood)
                            .ThenInclude(g => g.Supplier)
            .FirstOrDefaultAsync(
                os => os.Stops.Any(s => s.ClientOrder != null && s.ClientOrder.PublicId == orderPublicId),
                ct);

        if (shipment is null)
        {
            return;
        }

        // Past Created the run's content is fixed: what is on the truck has been decided, and
        // growing the route underneath a loaded run would contradict it.
        if (!ShipmentMutability.IsContentEditable(shipment.State))
        {
            return;
        }

        SupplierPickupStopReconciler.Apply(shipment);
        CompanyStopReconciler.Apply(shipment, company);
    }
}
