using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientDeliveryPlaces;

/// <summary>
/// A delivery place resolved from its public ID, with the owning client's
/// public ID alongside so callers can run the cross-client check without a
/// second query.
/// </summary>
public sealed record ResolvedDeliveryPlace(Guid PublicId, long Id, Guid ClientPublicId);

/// <summary>
/// Resolves client delivery places referenced by public ID to their internal
/// entity IDs, applying the two rules that the schema cannot express: a
/// soft-deleted place may not be newly assigned, and a place may only be used
/// by its own client. Shared by the order write path and
/// <c>ShipmentStopDeliveryPlaceResolver</c> so the rules cannot drift.
/// </summary>
public static class ClientDeliveryPlaceResolver
{
    /// <param name="allowedDeletedIds">
    /// Entity IDs of places already referenced by the row being saved. A
    /// soft-deleted place in this set is accepted — otherwise re-saving an
    /// entity whose place was deleted after it was chosen would fail forever,
    /// even though the read model deliberately keeps rendering that place.
    /// Only a *new* assignment onto a soft-deleted place is rejected.
    /// </param>
    public static async Task<List<ResolvedDeliveryPlace>> ResolveManyAsync(
        AleTrackDbContext dbContext,
        IReadOnlyCollection<Guid> placePublicIds,
        IReadOnlyCollection<long> allowedDeletedIds,
        CancellationToken ct)
    {
        if (placePublicIds.Count == 0)
            return [];

        var places = await dbContext.ClientDeliveryPlaces
            .Where(p => placePublicIds.Contains(p.PublicId)
                        && (!p.IsDeleted || allowedDeletedIds.Contains(p.Id)))
            .Select(p => new ResolvedDeliveryPlace(p.PublicId, p.Id, p.Client.PublicId))
            .ToListAsync(ct);

        var missing = placePublicIds.Where(id => places.All(p => p.PublicId != id)).ToList();
        if (missing.Count > 0)
            ThrowHelper.PublicEntitiesNotFound(nameof(ClientDeliveryPlace), missing);

        return places;
    }

    /// <summary>
    /// Single-place convenience for the order write path: resolves the place
    /// and asserts it belongs to <paramref name="clientPublicId"/>. Returns
    /// null when no place was requested.
    /// </summary>
    public static async Task<long?> ResolveForClientAsync(
        AleTrackDbContext dbContext,
        Guid clientPublicId,
        Guid? placePublicId,
        long? allowedDeletedId,
        CancellationToken ct)
    {
        if (placePublicId is null)
            return null;

        var places = await ResolveManyAsync(
            dbContext,
            [placePublicId.Value],
            allowedDeletedId.HasValue ? [allowedDeletedId.Value] : [],
            ct);

        var place = places[0];
        if (place.ClientPublicId != clientPublicId)
            ThrowHelper.BadRequest(
                $"Delivery place {place.PublicId} does not belong to client {clientPublicId}.");

        return place.Id;
    }
}
