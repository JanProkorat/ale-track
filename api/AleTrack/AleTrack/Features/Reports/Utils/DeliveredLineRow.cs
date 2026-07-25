using AleTrack.Common.Enums;
using AleTrack.Features.Products.Utils;
using AleTrack.Infrastructure.Persistence;

namespace AleTrack.Features.Reports.Utils;

/// <summary>
/// One delivered order line, flattened. <see cref="PackageSize"/> travels instead of a weight
/// because <c>Product.Weight</c> is an unmapped computed property — see <see cref="WeightKg"/>.
/// </summary>
public sealed record DeliveredLineRow
{
    /// <summary>
    /// The shipment's delivery timestamp, straight out of the `timestamptz` column. The day is
    /// derived in memory (<see cref="Date"/>) because casting a mapped column to a date inside
    /// the query is either untranslatable or session-timezone dependent.
    /// </summary>
    public DateTime DeliveredAtUtc { get; init; }

    /// <summary>Delivery day, derived client-side from <see cref="DeliveredAtUtc"/>.</summary>
    public DateOnly Date => DateOnly.FromDateTime(DeliveredAtUtc);

    public long ClientId { get; init; }
    public Guid ClientPublicId { get; init; }
    public string ClientName { get; init; } = null!;
    public Region ClientRegion { get; init; }
    public long BreweryId { get; init; }
    public Guid BreweryPublicId { get; init; }
    public string BreweryName { get; init; } = null!;
    public string? BreweryColor { get; init; }
    public long StopId { get; init; }
    public ProductKind Kind { get; init; }
    public ProductType Type { get; init; }
    public int Quantity { get; init; }
    public double? PackageSize { get; init; }

    /// <summary>Line weight in kg, or 0 when the product has no derivable unit weight.</summary>
    public decimal WeightKg => ProductWeightCalculator.ComputeLineWeightKg(Kind, PackageSize, Quantity);
}

/// <summary>
/// The one query every volume report starts from: order lines that actually reached the client.
/// </summary>
public static class DeliveredLineQuery
{
    /// <summary>
    /// Order lines on delivered shipments whose delivery date falls inside the window.
    /// Only <see cref="OutgoingShipmentStopKind.Order"/> stops carry products; custom stops and
    /// client/custom extra items are excluded from v1 volume by design (see the module spec).
    /// Projects raw columns only — never touch <c>Product.Weight</c> here, EF cannot translate it.
    /// </summary>
    /// <remarks>
    /// Callers must materialize (e.g. <c>ToListAsync</c>) before touching <see cref="DeliveredLineRow.Date"/>
    /// or <see cref="DeliveredLineRow.WeightKg"/> — both are computed in memory and composing a further
    /// <c>.Where</c>/<c>.OrderBy</c> onto the still-deferred <see cref="IQueryable{T}"/> reproduces the
    /// untranslatable-property bug. <c>Moq.EntityFrameworkCore</c> mocks LINQ-to-objects, so this mistake
    /// passes tests and only fails against a real Npgsql provider.
    /// </remarks>
    public static IQueryable<DeliveredLineRow> Project(AleTrackDbContext dbContext, DateOnly from, DateOnly to)
    {
        // Kind=Utc is mandatory: DeliveryDate is timestamptz and Npgsql rejects Unspecified.
        var fromDate = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDate = to.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        return dbContext.OrderItems
            .Where(oi => oi.Order.OutgoingShipmentStop != null
                         && oi.Order.OutgoingShipmentStop.Kind == OutgoingShipmentStopKind.Order
                         && oi.Order.OutgoingShipmentStop.OutgoingShipment.State == OutgoingShipmentState.Delivered
                         && oi.Order.OutgoingShipmentStop.OutgoingShipment.DeliveryDate != null
                         && oi.Order.OutgoingShipmentStop.OutgoingShipment.DeliveryDate >= fromDate
                         && oi.Order.OutgoingShipmentStop.OutgoingShipment.DeliveryDate <= toDate)
            .Select(oi => new DeliveredLineRow
            {
                DeliveredAtUtc = oi.Order.OutgoingShipmentStop!.OutgoingShipment.DeliveryDate!.Value,
                ClientId = oi.Order.ClientId,
                ClientPublicId = oi.Order.Client.PublicId,
                ClientName = oi.Order.Client.Name,
                ClientRegion = oi.Order.Client.Region,
                BreweryId = oi.Product.BreweryId,
                BreweryPublicId = oi.Product.Brewery.PublicId,
                BreweryName = oi.Product.Brewery.Name,
                BreweryColor = oi.Product.Brewery.Color,
                StopId = oi.Order.OutgoingShipmentStop.Id,
                Kind = oi.Product.Kind,
                Type = oi.Product.Type,
                Quantity = oi.Quantity,
                PackageSize = oi.Product.PackageSize
            });
    }
}
