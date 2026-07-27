using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ClientDeliveryPlaces;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// Applies a requested delivery address to an order. Shared by the create and
/// update endpoints so the checks that need the client row — which a
/// FluentValidation rule cannot reach — are written once.
/// </summary>
public static class OrderDeliveryAddressWriter
{
    /// <summary>
    /// Validates and applies the requested address. Returns true when the
    /// order's address actually changed, which is what the update endpoint
    /// uses to decide whether to propagate to the shipment stop.
    /// </summary>
    public static async Task<bool> ApplyAsync(
        AleTrackDbContext dbContext,
        Order order,
        Client client,
        DeliveryAddressKind kind,
        Guid? placePublicId,
        CancellationToken ct)
    {
        // The frontend merely hides the option; nothing stops a direct caller
        // from asking for a contact address the client does not have.
        if (kind == DeliveryAddressKind.Contact && client.ContactAddress is null)
            ThrowHelper.BadRequest($"Client {client.PublicId} has no contact address.");

        var placeId = await ClientDeliveryPlaceResolver.ResolveForClientAsync(
            dbContext,
            client.PublicId,
            placePublicId,
            allowedDeletedId: order.ClientDeliveryPlaceId,
            ct);

        var changed = order.DeliveryAddressKind != kind || order.ClientDeliveryPlaceId != placeId;

        order.DeliveryAddressKind = kind;
        order.ClientDeliveryPlaceId = placeId;

        return changed;
    }

    /// <summary>
    /// Pushes an order's newly changed delivery address onto the stop it is
    /// planned into, if any. An order has at most one stop, so this is a
    /// single-row update. Call it only when
    /// <see cref="ApplyAsync"/> reported an actual change.
    /// </summary>
    /// <remarks>
    /// A stop the planner overrode keeps its own address but is stamped all
    /// the same: the shipment then shows "the order disagrees with this stop",
    /// which is the more valuable of the two warnings. Stops on delivered or
    /// cancelled shipments are left alone entirely — their address is history.
    /// </remarks>
    public static async Task PropagateToStopAsync(
        AleTrackDbContext dbContext,
        Order order,
        DateTime now,
        CancellationToken ct)
    {
        // AleTrackDbContext has no direct DbSet<OutgoingShipmentStop>; reach the
        // stop through the shipments it belongs to instead.
        var stop = await dbContext.OutgoingShipments
            .Include(s => s.Stops)
            .SelectMany(s => s.Stops)
            .FirstOrDefaultAsync(s => s.ClientOrder != null && s.ClientOrder.PublicId == order.PublicId, ct);

        if (stop is null)
            return;

        if (stop.OutgoingShipment.State is OutgoingShipmentState.Delivered or OutgoingShipmentState.Cancelled)
            return;

        if (!stop.IsAddressOverridden)
        {
            stop.SelectedAddressKind = order.DeliveryAddressKind;
            stop.ClientDeliveryPlaceId = order.ClientDeliveryPlaceId;
        }

        stop.AddressChangedAt = now;
    }
}
