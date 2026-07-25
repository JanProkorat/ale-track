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
    public DateOnly Date { get; init; }
    public long ClientId { get; init; }
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
    public decimal WeightKg =>
        (decimal)((ProductWeightCalculator.Compute(Kind, PackageSize) ?? 0d) * Quantity);
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
    public static IQueryable<DeliveredLineRow> Project(AleTrackDbContext dbContext, DateOnly from, DateOnly to)
    {
        var fromDate = from.ToDateTime(TimeOnly.MinValue);
        var toDate = to.ToDateTime(TimeOnly.MaxValue);

        return dbContext.OrderItems
            .Where(oi => oi.Order.OutgoingShipmentStop != null
                         && oi.Order.OutgoingShipmentStop.Kind == OutgoingShipmentStopKind.Order
                         && oi.Order.OutgoingShipmentStop.OutgoingShipment.State == OutgoingShipmentState.Delivered
                         && oi.Order.OutgoingShipmentStop.OutgoingShipment.DeliveryDate != null
                         && oi.Order.OutgoingShipmentStop.OutgoingShipment.DeliveryDate >= fromDate
                         && oi.Order.OutgoingShipmentStop.OutgoingShipment.DeliveryDate <= toDate)
            .Select(oi => new DeliveredLineRow
            {
                Date = DateOnly.FromDateTime(oi.Order.OutgoingShipmentStop!.OutgoingShipment.DeliveryDate!.Value),
                ClientId = oi.Order.ClientId,
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
