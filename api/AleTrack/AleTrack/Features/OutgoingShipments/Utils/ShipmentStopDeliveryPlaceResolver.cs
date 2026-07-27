using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ClientDeliveryPlaces;
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
    /// <param name="dbContext"></param>
    /// <param name="clientOrderShipments"></param>
    /// <param name="alreadyReferencedPlaceIds">
    /// Entity IDs of <see cref="ClientDeliveryPlace"/> already attached to one
    /// of the shipment's existing stops (empty on create). A soft-deleted
    /// place in this set is still accepted — otherwise resaving a shipment
    /// whose stop already points at a place that got deleted *after* the
    /// stop was created would 404 forever, even though the read model
    /// deliberately keeps rendering that place for history. Only a *new*
    /// assignment onto a soft-deleted place is rejected.
    /// </param>
    /// <param name="ct"></param>
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
        IReadOnlyCollection<long>? alreadyReferencedPlaceIds,
        CancellationToken ct)
    {
        alreadyReferencedPlaceIds ??= [];

        var requestedIds = clientOrderShipments
            .Where(cos => cos.ClientDeliveryPlaceId.HasValue)
            .Select(cos => cos.ClientDeliveryPlaceId!.Value)
            .Distinct()
            .ToList();

        var places = await ClientDeliveryPlaceResolver.ResolveManyAsync(
            dbContext, requestedIds, alreadyReferencedPlaceIds, ct);

        if (places.Count == 0)
            return [];

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
