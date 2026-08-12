using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Row-level guard shared by every shipment endpoint that takes a shipment id. Keeps the
/// "assigned to me" rule in one place so the ten call sites cannot drift apart.
/// </summary>
public static class ShipmentDriverScopeGuard
{
    /// <summary>
    /// Does nothing for office staff. For a driver account, throws 404 unless the shipment
    /// exists and the caller is one of its assigned drivers.
    /// </summary>
    /// <param name="driverScope">Scope of the current caller.</param>
    /// <param name="dbContext">Database context.</param>
    /// <param name="shipmentPublicId">Public id of the shipment being acted on.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <remarks>
    /// 404 rather than 403 so a driver cannot use the response to learn which shipments
    /// exist. An unlinked driver account matches nothing and so is refused everywhere.
    /// </remarks>
    public static async Task EnsureAssignedAsync(
        IDriverScope driverScope,
        AleTrackDbContext dbContext,
        Guid shipmentPublicId,
        CancellationToken ct)
    {
        if (!driverScope.IsScoped)
        {
            return;
        }

        var scopedDriverId = await driverScope.GetDriverIdAsync(ct);
        var isAssigned = scopedDriverId is not null
            && await dbContext.OutgoingShipments
                .AsNoTracking()
                .AnyAsync(os => os.PublicId == shipmentPublicId
                    && os.Drivers.Any(d => d.DriverId == scopedDriverId), ct);

        if (!isAssigned)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), shipmentPublicId);
        }
    }
}
