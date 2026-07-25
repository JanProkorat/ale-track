using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Resolves the client delivery places requested on shipment stops to their
/// internal entity IDs. Shared by <c>CreateOutgoingShipmentEndpoint</c> and
/// <c>UpdateOutgoingShipmentEndpoint</c> so the validation rules (soft-delete,
/// cross-client ownership) cannot drift between the two write paths.
/// </summary>
public static class ShipmentStopDeliveryPlaceResolver
{
    /// <summary>
    /// Resolves the requested delivery places to their entity IDs, rejecting
    /// places that do not exist, are soft-deleted, or belong to a different
    /// client than the stop's order. Cross-client references are the one way
    /// this schema can go wrong, so the check is a DB lookup rather than a
    /// validator rule.
    /// </summary>
    /// <remarks>
    /// Precondition: this method does not itself verify that every
    /// <see cref="ClientOrderShipmentDto.ClientOrderId"/> refers to an
    /// existing order. When an order ID cannot be resolved to a client, the
    /// cross-client check is silently skipped for that entry — safe only
    /// because both shipment endpoints separately 404 on unknown orders
    /// elsewhere in the same request. A caller that resolves delivery places
    /// before validating order existence would lose this check.
    /// </remarks>
    public static async Task<Dictionary<Guid, long>> ResolveAsync(
        AleTrackDbContext dbContext,
        List<ClientOrderShipmentDto> clientOrderShipments,
        CancellationToken ct)
    {
        var requestedIds = clientOrderShipments
            .Where(cos => cos.ClientDeliveryPlaceId.HasValue)
            .Select(cos => cos.ClientDeliveryPlaceId!.Value)
            .Distinct()
            .ToList();

        if (requestedIds.Count == 0)
            return [];

        var places = await dbContext.ClientDeliveryPlaces
            .Where(p => requestedIds.Contains(p.PublicId) && !p.IsDeleted)
            .Select(p => new { p.PublicId, p.Id, ClientPublicId = p.Client.PublicId })
            .ToListAsync(ct);

        var missing = requestedIds.Where(id => places.All(p => p.PublicId != id)).ToList();
        if (missing.Count > 0)
            ThrowHelper.PublicEntitiesNotFound(nameof(ClientDeliveryPlace), missing);

        var orderClients = await dbContext.Orders
            .Where(o => clientOrderShipments.Select(cos => cos.ClientOrderId).Contains(o.PublicId))
            .Select(o => new { o.PublicId, ClientPublicId = o.Client.PublicId })
            .ToListAsync(ct);

        foreach (var dto in clientOrderShipments.Where(c => c.ClientDeliveryPlaceId.HasValue))
        {
            var place = places.First(p => p.PublicId == dto.ClientDeliveryPlaceId!.Value);
            var order = orderClients.FirstOrDefault(o => o.PublicId == dto.ClientOrderId);
            if (order is not null && order.ClientPublicId != place.ClientPublicId)
                ThrowHelper.BadRequest(
                    $"Delivery place {place.PublicId} does not belong to the client of order {dto.ClientOrderId}.");
        }

        return places.ToDictionary(p => p.PublicId, p => p.Id);
    }
}
