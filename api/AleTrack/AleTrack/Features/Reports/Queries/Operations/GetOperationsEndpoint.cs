using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
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
public sealed class GetOperationsEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope)
    : Endpoint<GetOperationsRequest, OperationsReportDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("reports/shipments/operations");
        Description(b => b
            .RequirePermission(ModuleType.Reports, PermissionLevel.View)
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
        // A driver's report is restricted to their own delivered work; office staff and admins
        // are unrestricted, so the driver id is resolved only when scoping actually applies.
        var scope = driverScope.IsScoped
            ? new DriverReportScope(true, await driverScope.GetDriverIdAsync(ct))
            : DriverReportScope.Unscoped;

        // Kind=Utc is mandatory: DeliveryDate is timestamptz and Npgsql rejects Unspecified.
        var fromDate = req.From.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDate = req.To.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        // Shipment-level facts. Projected flat so nothing computed leaks into SQL.
        IQueryable<OutgoingShipment> shipmentsQuery = dbContext.OutgoingShipments
            .Where(s => s.DeliveryDate != null && s.DeliveryDate >= fromDate && s.DeliveryDate <= toDate);

        // A driver sees only the shipments they are assigned to. Drivers.DriverId is a
        // non-nullable long, so an unlinked driver's null scope id matches nothing.
        if (scope.IsScoped)
        {
            shipmentsQuery = shipmentsQuery.Where(s => s.Drivers.Any(d => d.DriverId == scope.DriverId));
        }

        var shipments = await shipmentsQuery
            .Select(s => new
            {
                s.State,
                DeliveryDate = s.DeliveryDate!.Value,
                OrderStopCount = s.Stops.Count(st => st.Kind == OutgoingShipmentStopKind.Order),
                // Returns moved from the shipment onto the order they belong to, so they are
                // now reached through the run's order stops rather than off the shipment.
                ReturnedUnits = s.Stops
                    .Where(st => st.ClientOrder != null)
                    .SelectMany(st => st.ClientOrder!.Returns)
                    .Sum(r => (int?)r.Quantity) ?? 0,
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
        IQueryable<AleTrack.Entities.Order> punctualityQuery = dbContext.Orders
            .Where(o => o.State == OrderState.Finished
                        && o.RequiredDeliveryDate != null
                        && o.ActualDeliveryDate != null
                        && o.ActualDeliveryDate >= req.From
                        && o.ActualDeliveryDate <= req.To);

        // A driver's punctuality figure counts only orders carried on their own shipments — an
        // order qualifies when its stop belongs to a shipment the caller is assigned to.
        if (scope.IsScoped)
        {
            punctualityQuery = punctualityQuery.Where(o =>
                o.OutgoingShipmentStop != null
                && o.OutgoingShipmentStop.OutgoingShipment.Drivers.Any(d => d.DriverId == scope.DriverId));
        }

        var punctuality = await punctualityQuery
            .Select(o => new { Required = o.RequiredDeliveryDate!.Value, Actual = o.ActualDeliveryDate!.Value })
            .ToListAsync(ct);

        var onTimePercentage = punctuality.Count == 0
            ? 0m
            : Math.Round(punctuality.Count(p => p.Actual <= p.Required) * 100m / punctuality.Count, 1);

        // Outgoing weight per month, from the shared delivered-line projection.
        var outgoingRows = await DeliveredLineQuery.Project(dbContext, req.From, req.To, scope).ToListAsync(ct);
        var outgoingByMonth = outgoingRows
            .GroupBy(r => ReportBucketing.BucketStart(r.Date, ReportGranularity.Month))
            .ToDictionary(g => g.Key, g => g.Sum(r => r.WeightKg));

        // Incoming weight per month — raw columns only, weight computed below.
        //
        // Reads the line's own recorded weight inputs rather than the product's current ones,
        // matching the outgoing half above: DeliveredLineQuery reads the run's snapshot. Leaving
        // this side live left one series moving under a product edit while the other stayed put.
        // The formula stays live on both sides, so correcting it still reaches history.
        IQueryable<DeliveryItem> incomingRowsQuery = dbContext.DeliveryItems
            // Brewery product lines only. A supplier stop's lines are goods off a price list — a
            // CO₂ bottle, a crate — which state their size as free text and carry no ProductKind,
            // so there is no weight to compute for them. Excluded rather than defaulted: weighing
            // them as zero would be honest, but weighing them at all invites a later "fix" that
            // invents a kind and quietly puts gas bottles on the beer-tonnage axis.
            .Where(di => di.ProductId != null
                         // Finished only, mirroring the outgoing side's delivered-only rule. The
                         // spec's "delivered = actuals, not plans" principle applies to both sides
                         // of this chart: counting planned or cancelled Dovozy against delivered
                         // Vyvozy would compare unlike quantities on a shared axis.
                         && di.DeliveryStop.Delivery.State == ProductDeliveryState.Finished
                         && di.DeliveryStop.Delivery.Date >= req.From
                         && di.DeliveryStop.Delivery.Date <= req.To);

        // A driver's incoming series counts only deliveries they actually drove. ProductDelivery's
        // Drivers navigation is a direct many-to-many to Driver, so the comparison is on Driver.Id
        // — not Driver.DriverId, which does not exist on this side.
        if (scope.IsScoped)
        {
            incomingRowsQuery = incomingRowsQuery.Where(di =>
                di.DeliveryStop.Delivery.Drivers.Any(d => d.Id == scope.DriverId));
        }

        var incomingRows = await incomingRowsQuery
            .Select(di => new
            {
                di.DeliveryStop.Delivery.Date,
                di.Kind,
                di.PackageSize,
                di.UnitsPerPackage,
                di.Quantity
            })
            .ToListAsync(ct);

        var incomingByMonth = incomingRows
            .GroupBy(r => ReportBucketing.BucketStart(r.Date, ReportGranularity.Month))
            .ToDictionary(
                g => g.Key,
                // Kind is nullable on the column because supplier lines have none; those are
                // already filtered out above, so a null here would be a product line whose
                // snapshot never got written. Contributing nothing is the only honest answer —
                // there are no inputs to weigh.
                g => g.Sum(r => r.Kind is null
                    ? 0m
                    : ProductWeightCalculator.ComputeLineWeightKg(
                        r.Kind.Value, r.PackageSize, r.Quantity, r.UnitsPerPackage ?? 1)));

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
