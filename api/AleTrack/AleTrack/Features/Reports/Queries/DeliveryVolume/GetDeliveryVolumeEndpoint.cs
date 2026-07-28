using AleTrack.Common.Utils;
using AleTrack.Features.Reports.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reports.Queries.DeliveryVolume;

/// <summary>Request for the delivered-volume report over an inclusive date window.</summary>
public sealed record GetDeliveryVolumeRequest : ReportWindowRequest
{
    /// <summary>Bucket width of the returned trend series. Defaults to weekly.</summary>
    public ReportGranularity Granularity { get; set; } = ReportGranularity.Week;
}

/// <summary>
/// Delivered volume for the Objem tab: totals, per-kind / per-brewery / per-type breakdowns
/// and a trend series.
/// </summary>
/// <remarks>
/// Aggregation happens in memory on purpose: the per-unit weight comes from
/// <see cref="Features.Products.Utils.ProductWeightCalculator"/>, mirroring the unmapped
/// <c>Product.Weight</c> property, so it cannot be summed in SQL. Only the row projection runs
/// on the server; the windows involved are small enough for this to be cheap.
/// </remarks>
public sealed class GetDeliveryVolumeEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetDeliveryVolumeRequest, DeliveryVolumeReportDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("reports/delivery-volume");
        Description(b => b
            .RequireAuthenticated()
            .WithName(nameof(GetDeliveryVolumeEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets delivered volume aggregated over a date window";
            s.Responses[StatusCodes.Status200OK] = "Delivered volume totals, breakdowns and trend series";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetDeliveryVolumeRequest req, CancellationToken ct)
    {
        var rows = await DeliveredLineQuery.Project(dbContext, req.From, req.To).ToListAsync(ct);

        var result = new DeliveryVolumeReportDto
        {
            TotalWeightKg = rows.Sum(r => r.WeightKg),
            TotalUnits = rows.Sum(r => r.Quantity),
            ClientsServed = rows.Select(r => r.ClientPublicId).Distinct().Count(),

            UnitsByKind = rows
                .GroupBy(r => r.Kind)
                .Select(g => new VolumeByKindDto
                {
                    Kind = g.Key,
                    Units = g.Sum(r => r.Quantity),
                    WeightKg = g.Sum(r => r.WeightKg)
                })
                .OrderBy(k => k.Kind)
                .ToList(),

            ByBrewery = rows
                .GroupBy(r => new { r.BreweryPublicId, r.BreweryName, r.BreweryColor })
                .Select(g => new VolumeByBreweryDto
                {
                    BreweryId = g.Key.BreweryPublicId,
                    BreweryName = g.Key.BreweryName,
                    Color = g.Key.BreweryColor,
                    Units = g.Sum(r => r.Quantity),
                    WeightKg = g.Sum(r => r.WeightKg)
                })
                .OrderByDescending(b => b.WeightKg)
                .ToList(),

            ByType = rows
                .GroupBy(r => r.Type)
                .Select(g => new VolumeByTypeDto
                {
                    Type = g.Key,
                    Units = g.Sum(r => r.Quantity),
                    WeightKg = g.Sum(r => r.WeightKg)
                })
                .OrderByDescending(t => t.WeightKg)
                .ToList(),

            Series = ReportBucketing.RollUp(
                rows.GroupBy(r => r.Date)
                    .Select(g => new DailyBucket(g.Key, g.Sum(r => r.WeightKg), g.Sum(r => r.Quantity))),
                req.Granularity)
        };

        await Send.OkAsync(result, ct);
    }
}
