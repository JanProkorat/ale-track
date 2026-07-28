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

    public Guid ClientPublicId { get; init; }
    public string ClientName { get; init; } = null!;
    public Region ClientRegion { get; init; }
    public Guid BreweryPublicId { get; init; }
    public string BreweryName { get; init; } = null!;
    public string? BreweryColor { get; init; }
    public long StopId { get; init; }
    public ProductKind Kind { get; init; }
    public ProductType Type { get; init; }
    public int Quantity { get; init; }
    public double? PackageSize { get; init; }

    /// <summary>Containers per sellable unit — 20 for a 0.5 l crate, 8 for an eight-pack.</summary>
    public int UnitsPerPackage { get; init; } = 1;

    /// <summary>Line weight in kg, or 0 when the product has no derivable unit weight.</summary>
    public decimal WeightKg =>
        ProductWeightCalculator.ComputeLineWeightKg(Kind, PackageSize, Quantity, UnitsPerPackage);
}

/// <summary>
/// The one query every volume report starts from: what delivered runs recorded carrying.
/// </summary>
public static class DeliveredLineQuery
{
    /// <summary>
    /// Snapshotted stop lines on delivered shipments whose delivery date falls inside the window.
    /// Only <see cref="OutgoingShipmentStopKind.Order"/> stops carry products; custom stops and
    /// client/custom extra items are excluded from v1 volume by design (see the module spec).
    /// </summary>
    /// <remarks>
    /// Reads the run's own snapshot rather than the live product, so editing a product or renaming
    /// a client no longer restates delivered history. Brewery colour is the deliberate exception:
    /// it is presentation rather than fact, so recolouring a brewery repaints old charts too.
    ///
    /// The weight is still derived, never stored — <see cref="DeliveredLineRow.WeightKg"/> runs
    /// <c>ProductWeightCalculator</c> over the snapshotted inputs. A correction to the formula
    /// therefore still reaches history, while a correction to the product data it consumes no
    /// longer does.
    ///
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

        return dbContext.OutgoingShipmentStopItems
            .Where(si => si.Stop.Kind == OutgoingShipmentStopKind.Order
                         && si.Stop.OutgoingShipment.State == OutgoingShipmentState.Delivered
                         && si.Stop.OutgoingShipment.DeliveryDate != null
                         && si.Stop.OutgoingShipment.DeliveryDate >= fromDate
                         && si.Stop.OutgoingShipment.DeliveryDate <= toDate)
            .Select(si => new DeliveredLineRow
            {
                DeliveredAtUtc = si.Stop.OutgoingShipment.DeliveryDate!.Value,
                ClientPublicId = si.Stop.ClientPublicId!.Value,
                ClientName = si.Stop.ClientName!,
                ClientRegion = si.Stop.ClientRegion!.Value,
                BreweryPublicId = si.BreweryPublicId,
                BreweryName = si.BreweryName,
                // Live, deliberately: colour is presentation, so recolouring a brewery must
                // repaint historical charts rather than leave them on the old swatch.
                BreweryColor = dbContext.Breweries
                    .Where(b => b.PublicId == si.BreweryPublicId)
                    .Select(b => b.Color)
                    .FirstOrDefault(),
                StopId = si.StopId,
                Kind = si.Kind,
                Type = si.Type,
                Quantity = si.Quantity,
                PackageSize = si.PackageSize,
                UnitsPerPackage = si.UnitsPerPackage
            });
    }
}
