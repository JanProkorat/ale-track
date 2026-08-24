using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ClientDeliveryPlaces;
using AleTrack.Features.Clients.Utils;
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
        // Official and Contact fall back on each other everywhere they are read, so either
        // kind is legal as long as the client has one of the two — that is what the order
        // detail, the export and the stop already display. Only a client with neither
        // address is rejected, which is the state the picker warns about.
        if (kind is DeliveryAddressKind.Official or DeliveryAddressKind.Contact
            && client is { OfficialAddress: null, ContactAddress: null })
            ThrowHelper.BadRequest($"Client {client.PublicId} has no billing or contact address.");

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
    ///
    /// This is also the first of the two paths that can move a delivery, so it
    /// records the move in the client's ledger — but only once the run has left
    /// <see cref="OutgoingShipmentState.Created"/>. Before that the order is
    /// still the plan, and editing the plan is not a deviation from it.
    /// </remarks>
    public static async Task PropagateToStopAsync(
        AleTrackDbContext dbContext,
        Order order,
        DateTime now,
        CancellationToken ct,
        long? userId = null)
    {
        // AleTrackDbContext has no direct DbSet<OutgoingShipmentStop>; reach the
        // stop through the shipments it belongs to instead. The Include must
        // come AFTER SelectMany and target the stop's own OutgoingShipment
        // navigation — an Include(s => s.Stops) placed before SelectMany gets
        // silently dropped once the query is reshaped from OutgoingShipment to
        // OutgoingShipmentStop, leaving the back-navigation null.
        var stop = await dbContext.OutgoingShipments
            .SelectMany(s => s.Stops)
            .Include(s => s.OutgoingShipment)
            .FirstOrDefaultAsync(s => s.ClientOrder != null && s.ClientOrder.PublicId == order.PublicId, ct);

        if (stop is null)
            return;

        if (stop.OutgoingShipment.State is OutgoingShipmentState.Delivered or OutgoingShipmentState.Cancelled)
            return;

        // Captured before the mutation below, and rendered rather than compared as a
        // (kind, place) pair: what the ledger needs is where the van was going to go.
        var recordable = order.Client is not null
                         && ClientLedgerAddressWriter.IsRecordable(stop.OutgoingShipment.State);

        var before = recordable
            ? await DeliveryAddressText.RenderAsync(
                dbContext, order.Client, stop.SelectedAddressKind, stop.ClientDeliveryPlaceId, ct)
            : null;

        if (!stop.IsAddressOverridden)
        {
            stop.SelectedAddressKind = order.DeliveryAddressKind;
            stop.ClientDeliveryPlaceId = order.ClientDeliveryPlaceId;
        }

        // Re-derive rather than trust the pre-edit flag: on the inherit branch
        // it now always matches (false); on the override branch the operator
        // may just have edited the order onto the exact address the planner
        // already chose, which should clear the flag too. Otherwise this
        // fourth writer of the (kind, placeId, overridden) invariant would
        // leave it stale-true until the whole shipment is re-saved.
        stop.DeriveAddressOverride(order);

        stop.AddressChangedAt = now;

        if (!recordable)
            return;

        var after = await DeliveryAddressText.RenderAsync(
            dbContext, order.Client, stop.SelectedAddressKind, stop.ClientDeliveryPlaceId, ct);

        await ClientLedgerAddressWriter.RecordAsync(dbContext, order, stop, before, after, userId, now, ct);
    }
}
