using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ClientDeliveryPlaces;
using AleTrack.Infrastructure.Persistence;

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
}
