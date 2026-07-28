using AleTrack.Common.Enums;

namespace AleTrack.Features.Products.Utils;

/// <summary>
/// Gross weight in kilograms of one packaged unit, derived from its kind and package size.
/// The single source of truth: <see cref="Entities.Product.Weight"/> delegates here, and the
/// reporting handlers call it directly because <c>Product.Weight</c> is an unmapped computed
/// property that EF Core cannot translate to SQL.
/// </summary>
/// <remarks>
/// A unit is one sellable package, which is not always one container. <c>ProductKind.Bottle</c>
/// renders as "Basa" — a crate — so a bottled unit is a full crate and the weight covers the
/// bottles plus the crate. How many bottles a crate holds follows from the seed data's own
/// price ratio (<c>PriceWithVat / PriceForUnitWithVat</c>): 20 at 0.5 l, 24 at 0.33 l, and 1 for
/// the 1 l and 2 l decorative bottles, which are sold singly.
///
/// <c>ProductKind.Multipack</c> is deliberately absent: its pack count (6, 7 or 8) exists only in
/// the product name, never in a column, so no size-keyed lookup can be correct for all of them.
/// Those lines weigh 0 until the model carries a units-per-package figure.
/// </remarks>
public static class ProductWeightCalculator
{
    public static double? Compute(ProductKind kind, double? packageSize)
    {
        if (packageSize == null)
            return null;

        return kind switch
        {
            // Crates. 0.33 l and 0.5 l are the common returnable sizes; 10 l is the legacy
            // encoding where package size held the crate's total volume rather than the bottle's.
            ProductKind.Bottle when packageSize == BottleSize.ZeroPointThreeThreeLiters => PackageWeight.SeventeenKilos,
            ProductKind.Bottle when packageSize == BottleSize.ZeroPointFiveLiters => PackageWeight.TwentyKilos,
            ProductKind.Bottle when packageSize == BottleSize.TenLiters => PackageWeight.TwentyKilos,
            // Sold as single bottles, so these stay per-bottle.
            ProductKind.Bottle when packageSize == BottleSize.OneLiter => PackageWeight.OneKilo,
            ProductKind.Bottle when packageSize == BottleSize.TwoLiters => PackageWeight.TwoKilos,
            ProductKind.Keg when packageSize == KegSize.FiveLiters => PackageWeight.FiveKilos,
            ProductKind.Keg when packageSize == KegSize.FifteenLiters => PackageWeight.TwentyKilos,
            ProductKind.Keg when packageSize == KegSize.TwentyLiters => PackageWeight.TwentyKilos,
            ProductKind.Keg when packageSize == KegSize.ThirtyLiters => PackageWeight.FortyTwoKilos,
            ProductKind.Keg when packageSize == KegSize.FiftyLiters => PackageWeight.SixtyTwoKilos,
            ProductKind.Can when packageSize == CanSize.ZeroPointThreeThreeLiters => PackageWeight.ZeroPointThree,
            ProductKind.Can when packageSize == CanSize.ZeroPointFiveLiters => PackageWeight.ZeroPointFive,
            ProductKind.Can when packageSize == CanSize.TwoLiters => PackageWeight.TwoKilos,
            _ => null
        };
    }

    /// <summary>
    /// Total weight in kilograms of <paramref name="quantity"/> units of one line, or 0 when the
    /// product has no derivable unit weight. The single formula both report sides share —
    /// <see cref="AleTrack.Features.Reports.Utils.DeliveredLineRow.WeightKg"/> (outgoing) and the incoming-weight
    /// projection in <c>GetOperationsEndpoint</c> — so the one-axis incoming/outgoing chart
    /// cannot drift apart from a duplicated cast/rounding difference.
    /// </summary>
    public static decimal ComputeLineWeightKg(ProductKind kind, double? packageSize, int quantity) =>
        (decimal)((Compute(kind, packageSize) ?? 0d) * quantity);
}
