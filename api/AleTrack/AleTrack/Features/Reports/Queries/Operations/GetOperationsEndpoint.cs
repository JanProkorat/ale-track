using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.Products.Utils;
using AleTrack.Features.Reports.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reports.Queries.Operations;

/// <summary>Request for the operations report over an inclusive date window.</summary>
public sealed record GetOperationsRequest : ReportWindowRequest;

/// <summary>
/// Operational figures for the Provoz tab: shipment states, punctuality, returnables,
/// incoming vs outgoing weight, and per-driver throughput.
/// </summary>
/// <remarks>
/// Weights are summed in memory for the same reason as the other report endpoints — the per-unit
/// figure comes from <see cref="ProductWeightCalculator"/>, which EF Core cannot translate.
/// v1 counts order-line products only on the outgoing side.
/// </remarks>
public sealed class GetOperationsEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetOperationsRequest, OperationsReportDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("reports/operations");
        Description(b => b
            .RequireAuthenticated()
            .WithName(nameof(GetOperationsEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets operational figures over a date window";
            s.Responses[StatusCodes.Status200OK] = "Shipment states, punctuality, returns and driver throughput";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetOperationsRequest req, CancellationToken ct)
    {
        // Kind=Utc is mandatory: DeliveryDate is timestamptz and Npgsql rejects Unspecified.
        var fromDate = req.From.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDate = req.To.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        // Shipment-level facts. Projected flat so nothing computed leaks into SQL.
        var shipments = await dbContext.OutgoingShipments
            .Where(s => s.DeliveryDate != null && s.DeliveryDate >= fromDate && s.DeliveryDate <= toDate)
            .Select(s => new
            {
                s.State,
                DeliveryDate = s.DeliveryDate!.Value,
                OrderStopCount = s.Stops.Count(st => st.Kind == OutgoingShipmentStopKind.Order),
                ReturnedUnits = s.Returns.Sum(r => (int?)r.Quantity) ?? 0,
                Drivers = s.Drivers.Select(d => new
                {
                    d.Driver.PublicId,
                    d.Driver.FirstName,
                    d.Driver.LastName,
                    d.Driver.Color
                }).ToList()
            })
            .ToListAsync(ct);

        var delivered = shipments.Where(s => s.State == OutgoingShipmentState.Delivered).ToList();

        // Punctuality over finished orders that actually carry a required date.
        var punctuality = await dbContext.Orders
            .Where(o => o.State == OrderState.Finished
                        && o.RequiredDeliveryDate != null
                        && o.ActualDeliveryDate != null
                        && o.ActualDeliveryDate >= req.From
                        && o.ActualDeliveryDate <= req.To)
            .Select(o => new { Required = o.RequiredDeliveryDate!.Value, Actual = o.ActualDeliveryDate!.Value })
            .ToListAsync(ct);

        var onTimePercentage = punctuality.Count == 0
            ? 0m
            : Math.Round(punctuality.Count(p => p.Actual <= p.Required) * 100m / punctuality.Count, 1);

        // Outgoing weight per month, from the shared delivered-line projection.
        var outgoingRows = await DeliveredLineQuery.Project(dbContext, req.From, req.To).ToListAsync(ct);
        var outgoingByMonth = outgoingRows
            .GroupBy(r => ReportBucketing.BucketStart(r.Date, ReportGranularity.Month))
            .ToDictionary(g => g.Key, g => g.Sum(r => r.WeightKg));

        // Incoming weight per month — raw columns only, weight computed below.
        var incomingRows = await dbContext.DeliveryItems
            // Finished only, mirroring the outgoing side's delivered-only rule. The spec's
            // "delivered = actuals, not plans" principle applies to both sides of this chart:
            // counting planned or cancelled Dovozy against delivered Vyvozy would compare
            // unlike quantities on a shared axis.
            .Where(di => di.DeliveryStop.Delivery.State == ProductDeliveryState.Finished
                         && di.DeliveryStop.Delivery.Date >= req.From
                         && di.DeliveryStop.Delivery.Date <= req.To)
            .Select(di => new
            {
                di.DeliveryStop.Delivery.Date,
                di.Product.Kind,
                di.Product.PackageSize,
                di.Quantity
            })
            .ToListAsync(ct);

        var incomingByMonth = incomingRows
            .GroupBy(r => ReportBucketing.BucketStart(r.Date, ReportGranularity.Month))
            .ToDictionary(
                g => g.Key,
                g => g.Sum(r => ProductWeightCalculator.ComputeLineWeightKg(r.Kind, r.PackageSize, r.Quantity)));

        var result = new OperationsReportDto
        {
            TotalShipments = shipments.Count,
            TotalStops = shipments.Sum(s => s.OrderStopCount),
            OnTimePercentage = onTimePercentage,
            ReturnableUnits = delivered.Sum(s => s.ReturnedUnits),

            ShipmentsByState = shipments
                .GroupBy(s => s.State)
                .Select(g => new ShipmentStateCountDto { State = g.Key, Count = g.Count() })
                .OrderBy(s => s.State)
                .ToList(),

            ByDriver = delivered
                .SelectMany(s => s.Drivers)
                .GroupBy(d => new { d.PublicId, d.FirstName, d.LastName, d.Color })
                .Select(g => new DriverShipmentsDto
                {
                    DriverId = g.Key.PublicId,
                    DriverName = $"{g.Key.FirstName} {g.Key.LastName}",
                    Color = g.Key.Color,
                    DeliveredShipments = g.Count()
                })
                .OrderByDescending(d => d.DeliveredShipments)
                .ThenBy(d => d.DriverName)
                .ToList(),

            IncomingVsOutgoing = outgoingByMonth.Keys
                .Union(incomingByMonth.Keys)
                .OrderBy(m => m)
                .Select(m => new IncomingVsOutgoingDto
                {
                    Month = m,
                    IncomingWeightKg = incomingByMonth.GetValueOrDefault(m),
                    OutgoingWeightKg = outgoingByMonth.GetValueOrDefault(m)
                })
                .ToList()
        };

        result.ActiveDrivers = result.ByDriver.Count;

        await Send.OkAsync(result, ct);
    }
}
