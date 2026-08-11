using AleTrack.Common.Enums;

namespace AleTrack.Features.Products.Utils;

/// <summary>
/// Gross weight in kilograms of one sellable unit: every container it holds, plus the outer
/// packaging. The single source of truth — <see cref="Entities.Product.Weight"/> delegates here,
/// and the reporting handlers call it directly because <c>Product.Weight</c> is an unmapped
/// computed property EF Core cannot translate to SQL.
/// </summary>
/// <remarks>
/// A unit is a package, not a container. <c>ProductKind.Bottle</c> renders as "Basa", so a bottled
/// unit is a crate: 20 containers at 0.5 l, 24 at 0.33 l. That count comes from
/// <see cref="Entities.Product.UnitsPerPackage"/> rather than being inferred from the package size,
/// which is what previously left multipacks with no computable weight — their pack count existed
/// only in the product name.
/// </remarks>
public static class ProductWeightCalculator
{
    /// <summary>
    /// Weight of one sellable unit from the explicit packaging pair. Preferred over the
    /// <see cref="ProductKind"/> overload: the outer tare comes from what the unit actually is
    /// rather than from guessing a crate whenever a bottled unit held six or more.
    /// </summary>
    public static double? Compute(
        ProductContainer container, ProductSaleUnit saleUnit, double? containerVolumeLiters,
        int unitsPerPackage = 1)
    {
        if (containerVolumeLiters == null)
        {
            return null;
        }

        var singleContainer = SingleContainerWeightKg(container, containerVolumeLiters.Value);
        if (singleContainer == null)
        {
            return null;
        }

        // A unit always holds at least one container, whatever an older row happens to say.
        var units = Math.Max(1, unitsPerPackage);

        return units * singleContainer.Value + OuterTareKg(saleUnit);
    }

    /// <summary>
    /// Weight of one sellable unit, or <c>null</c> when the container size is not one we hold a
    /// figure for.
    /// </summary>
    public static double? Compute(ProductKind kind, double? packageSize, int unitsPerPackage = 1)
    {
        if (packageSize == null)
            return null;

        var container = SingleContainerWeightKg(kind, packageSize.Value);
        if (container == null)
            return null;

        // Guard against 0 or negative reaching us from older rows written before the column
        // existed: a unit always holds at least one container.
        var units = Math.Max(1, unitsPerPackage);

        return units * container.Value + OuterTareKg(kind, units);
    }

    /// <summary>
    /// Total weight of <paramref name="quantity"/> units of one line, or 0 when the product has no
    /// derivable unit weight. The one formula both report sides share —
    /// <see cref="AleTrack.Features.Reports.Utils.DeliveredLineRow.WeightKg"/> (outgoing) and the
    /// incoming projection in <c>GetOperationsEndpoint</c> — so the shared-axis incoming/outgoing
    /// chart cannot drift apart through a duplicated cast or rounding difference.
    /// </summary>
    public static decimal ComputeLineWeightKg(
        ProductKind kind, double? packageSize, int quantity, int unitsPerPackage = 1) =>
        (decimal)((Compute(kind, packageSize, unitsPerPackage) ?? 0d) * quantity);

    /// <summary>
    /// One filled container. A jug weighs what the equivalent glass bottle weighs, because that is
    /// what it is — the difference between the two is which grouping they belong to, not their mass.
    /// </summary>
    private static double? SingleContainerWeightKg(ProductContainer container, double volumeLiters) =>
        container switch
        {
            ProductContainer.Bottle or ProductContainer.Jug => volumeLiters switch
            {
                BottleSize.ZeroPointThreeThreeLiters => PackageWeight.BottleZeroPointThreeThree,
                BottleSize.ZeroPointFiveLiters => PackageWeight.BottleZeroPointFive,
                BottleSize.OneLiter => PackageWeight.BottleOneLiter,
                BottleSize.TwoLiters => PackageWeight.BottleTwoLiters,
                // Superseded encoding: package size held the crate's total volume, not the bottle's.
                // The migration maps such a row to a single unit, so this figure already covers the
                // crate and must not be multiplied or charged tare again.
                BottleSize.TenLiters => PackageWeight.BottleZeroPointFive * 20 + PackageWeight.CrateTare,
                _ => null,
            },
            ProductContainer.Can => volumeLiters switch
            {
                CanSize.ZeroPointThreeThreeLiters => PackageWeight.CanZeroPointThreeThree,
                CanSize.ZeroPointFiveLiters => PackageWeight.CanZeroPointFive,
                CanSize.TwoLiters => PackageWeight.CanTwoLiters,
                _ => null,
            },
            ProductContainer.Keg => volumeLiters switch
            {
                KegSize.FiveLiters => PackageWeight.KegFiveLiters,
                KegSize.FifteenLiters => PackageWeight.KegFifteenLiters,
                KegSize.TwentyLiters => PackageWeight.KegTwentyLiters,
                KegSize.ThirtyLiters => PackageWeight.KegThirtyLiters,
                KegSize.FiftyLiters => PackageWeight.KegFiftyLiters,
                _ => null,
            },
            _ => null,
        };

    /// <summary>
    /// Outer packaging, counted once per unit. Read straight off the sale unit — a crate is charged
    /// for being a crate, not for holding enough containers to look like one.
    /// </summary>
    private static double OuterTareKg(ProductSaleUnit saleUnit) => saleUnit switch
    {
        ProductSaleUnit.Crate => PackageWeight.CrateTare,
        ProductSaleUnit.Multipack => PackageWeight.MultipackTare,
        _ => 0d,
    };

    /// <summary>One filled bottle, can or keg. Multipacks hold bottles.</summary>
    private static double? SingleContainerWeightKg(ProductKind kind, double packageSize) => kind switch
    {
        ProductKind.Bottle or ProductKind.Multipack => packageSize switch
        {
            BottleSize.ZeroPointThreeThreeLiters => PackageWeight.BottleZeroPointThreeThree,
            BottleSize.ZeroPointFiveLiters => PackageWeight.BottleZeroPointFive,
            BottleSize.OneLiter => PackageWeight.BottleOneLiter,
            BottleSize.TwoLiters => PackageWeight.BottleTwoLiters,
            // Legacy encoding: package size held the crate's total volume, not the bottle's. Such
            // a row is already one whole crate, so it needs no multiplier.
            BottleSize.TenLiters => PackageWeight.BottleZeroPointFive * 20 + PackageWeight.CrateTare,
            _ => null,
        },
        ProductKind.Can => packageSize switch
        {
            CanSize.ZeroPointThreeThreeLiters => PackageWeight.CanZeroPointThreeThree,
            CanSize.ZeroPointFiveLiters => PackageWeight.CanZeroPointFive,
            CanSize.TwoLiters => PackageWeight.CanTwoLiters,
            _ => null,
        },
        ProductKind.Keg => packageSize switch
        {
            KegSize.FiveLiters => PackageWeight.KegFiveLiters,
            KegSize.FifteenLiters => PackageWeight.KegFifteenLiters,
            KegSize.TwentyLiters => PackageWeight.KegTwentyLiters,
            KegSize.ThirtyLiters => PackageWeight.KegThirtyLiters,
            KegSize.FiftyLiters => PackageWeight.KegFiftyLiters,
            _ => null,
        },
        _ => null,
    };

    /// <summary>Outer packaging, counted once per unit rather than per container.</summary>
    private static double OuterTareKg(ProductKind kind, int units) => kind switch
    {
        // A single or paired bottle ships without a crate; a full basa does not.
        ProductKind.Bottle when units >= 6 => PackageWeight.CrateTare,
        ProductKind.Multipack => PackageWeight.MultipackTare,
        _ => 0d,
    };
}
