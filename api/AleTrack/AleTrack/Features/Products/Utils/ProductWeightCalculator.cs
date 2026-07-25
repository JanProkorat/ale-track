using AleTrack.Common.Enums;

namespace AleTrack.Features.Products.Utils;

/// <summary>
/// Net weight in kilograms of one packaged unit, derived from its kind and package size.
/// The single source of truth: <see cref="Entities.Product.Weight"/> delegates here, and the
/// reporting handlers call it directly because <c>Product.Weight</c> is an unmapped computed
/// property that EF Core cannot translate to SQL.
/// </summary>
public static class ProductWeightCalculator
{
    public static double? Compute(ProductKind kind, double? packageSize)
    {
        if (packageSize == null)
            return null;

        return kind switch
        {
            ProductKind.Bottle when packageSize == BottleSize.OneLiter => PackageWeight.OneKilo,
            ProductKind.Bottle when packageSize == BottleSize.TwoLiters => PackageWeight.TwoKilos,
            ProductKind.Bottle when packageSize == BottleSize.TenLiters => PackageWeight.TwentyKilos,
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
}
