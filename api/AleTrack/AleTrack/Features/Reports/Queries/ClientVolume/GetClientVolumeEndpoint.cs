using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.Reports.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reports.Queries.ClientVolume;

/// <summary>Request for the per-client volume report over an inclusive date window.</summary>
public sealed record GetClientVolumeRequest : ReportWindowRequest;

/// <summary>
/// Per-client and per-region delivered volume for the Klienti tab.
/// </summary>
/// <remarks>
/// Same in-memory aggregation rationale as the delivery-volume endpoint: unit weight comes from
/// the unmapped <c>Product.Weight</c> equivalent, so only the row projection runs in SQL.
/// v1 counts order-line products only — client/custom extra items are out of scope (see spec).
/// </remarks>
public sealed class GetClientVolumeEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope)
    : Endpoint<GetClientVolumeRequest, ClientVolumeReportDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("reports/client-volume");
        Description(b => b
            .RequirePermission(ModuleType.Reports, PermissionLevel.View)
            .WithName(nameof(GetClientVolumeEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets delivered volume per client over a date window";
            s.Responses[StatusCodes.Status200OK] = "Per-client and per-region delivered volume";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientVolumeRequest req, CancellationToken ct)
    {
        // A driver's report is restricted to their own delivered work; office staff and admins
        // are unrestricted, so the driver id is resolved only when scoping actually applies.
        var scope = driverScope.IsScoped
            ? new DriverReportScope(true, await driverScope.GetDriverIdAsync(ct))
            : DriverReportScope.Unscoped;

        var rows = await DeliveredLineQuery.Project(dbContext, req.From, req.To, scope).ToListAsync(ct);

        var topClients = rows
            .GroupBy(r => new { r.ClientPublicId, r.ClientName, r.ClientRegion })
            .Select(g => new ClientVolumeRowDto
            {
                ClientId = g.Key.ClientPublicId,
                ClientName = g.Key.ClientName,
                Region = g.Key.ClientRegion,
                // One stop is one drop-off, however many lines it carried.
                Deliveries = g.Select(r => r.StopId).Distinct().Count(),
                Units = g.Sum(r => r.Quantity),
                WeightKg = g.Sum(r => r.WeightKg)
            })
            .OrderByDescending(c => c.WeightKg)
            .ThenBy(c => c.ClientName)
            .ToList();

        var result = new ClientVolumeReportDto
        {
            ClientsServed = topClients.Count,
            TotalDeliveries = topClients.Sum(c => c.Deliveries),
            TotalWeightKg = rows.Sum(r => r.WeightKg),
            TopClients = topClients,
            ByRegion = rows
                .GroupBy(r => r.ClientRegion)
                .Select(g => new VolumeByRegionDto
                {
                    Region = g.Key,
                    Units = g.Sum(r => r.Quantity),
                    WeightKg = g.Sum(r => r.WeightKg)
                })
                .OrderByDescending(r => r.WeightKg)
                .ThenBy(r => r.Region)
                .ToList()
        };

        await Send.OkAsync(result, ct);
    }
}
