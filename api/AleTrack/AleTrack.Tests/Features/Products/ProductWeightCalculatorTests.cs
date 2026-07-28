using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// A unit is one sellable package, not one container: a bottled product is a crate ("Basa"), so its
/// weight is <c>UnitsPerPackage × container + outer tare</c>. A missing container size fails
/// silently — it returns 0 kg and understates every weight figure in the Reporty module.
/// </summary>
public sealed class ProductWeightCalculatorTests
{
    [Theory]
    // Single containers: one unit, no outer packaging.
    [InlineData(ProductKind.Keg, KegSize.FiveLiters, 1, 5.0)]
    [InlineData(ProductKind.Keg, KegSize.FifteenLiters, 1, 20.0)]
    [InlineData(ProductKind.Keg, KegSize.TwentyLiters, 1, 20.0)]
    [InlineData(ProductKind.Keg, KegSize.ThirtyLiters, 1, 42.0)]
    [InlineData(ProductKind.Keg, KegSize.FiftyLiters, 1, 62.0)]
    [InlineData(ProductKind.Can, CanSize.ZeroPointThreeThreeLiters, 1, 0.33)]
    [InlineData(ProductKind.Can, CanSize.ZeroPointFiveLiters, 1, 0.5)]
    [InlineData(ProductKind.Can, CanSize.TwoLiters, 1, 2.0)]
    // Decorative bottles sold singly: no crate, so no crate tare.
    [InlineData(ProductKind.Bottle, BottleSize.OneLiter, 1, 1.6)]
    [InlineData(ProductKind.Bottle, BottleSize.TwoLiters, 1, 2.8)]
    public void Compute_HandlesSingleContainerUnits(
        ProductKind kind, double size, int units, double expected)
    {
        ProductWeightCalculator.Compute(kind, size, units).Should().BeApproximately(expected, 0.001);
    }

    [Theory]
    // 20 × 0.885 + 2.0 crate = 19.7
    [InlineData(BottleSize.ZeroPointFiveLiters, 20, 19.7)]
    // 24 × 0.62 + 2.0 crate = 16.88
    [InlineData(BottleSize.ZeroPointThreeThreeLiters, 24, 16.88)]
    public void Compute_DerivesCrateWeightFromTheUnitCount(double size, int units, double expected)
    {
        ProductWeightCalculator.Compute(ProductKind.Bottle, size, units)
            .Should().BeApproximately(expected, 0.001);
    }

    [Fact]
    public void CrateWeight_LandsWhereThePublishedFigureDoes()
    {
        // A full 20 × 0.5 l basa is documented at 18-20 kg, and the superseded
        // Bottle/TenLiters entry encoded the same object as 20 kg. Both agree.
        ProductWeightCalculator.Compute(ProductKind.Bottle, BottleSize.ZeroPointFiveLiters, 20)!
            .Value.Should().BeInRange(18.0, 20.0);
    }

    [Theory]
    // The whole point of the column: pack count used to live only in the product name, so every
    // multipack weighed nothing at all.
    [InlineData(BottleSize.ZeroPointFiveLiters, 8, 7.23)]   // "Prim. Premium 8x"
    [InlineData(BottleSize.ZeroPointFiveLiters, 7, 6.345)]  // "Svijany - 7 svijanských kousků"
    [InlineData(BottleSize.ZeroPointFiveLiters, 6, 5.46)]   // "Svijany 6 piv + sklenička"
    [InlineData(BottleSize.OneLiter, 2, 3.35)]              // duo pack
    public void Compute_WeighsMultipacksByTheirPackCount(double size, int units, double expected)
    {
        ProductWeightCalculator.Compute(ProductKind.Multipack, size, units)
            .Should().BeApproximately(expected, 0.001);
    }

    [Fact]
    public void MultipackWeights_ScaleWithPackCount()
    {
        // The failure the old size-keyed lookup could not avoid: one constant for 6, 7 and 8 packs.
        var six = ProductWeightCalculator.Compute(ProductKind.Multipack, 0.5, 6)!.Value;
        var seven = ProductWeightCalculator.Compute(ProductKind.Multipack, 0.5, 7)!.Value;
        var eight = ProductWeightCalculator.Compute(ProductKind.Multipack, 0.5, 8)!.Value;

        six.Should().BeLessThan(seven);
        seven.Should().BeLessThan(eight);
    }

    [Fact]
    public void SingleBottle_CarriesNoCrateTare()
    {
        // Same container, different packaging: a lone bottle must not be charged for a crate.
        var single = ProductWeightCalculator.Compute(ProductKind.Bottle, 0.5, 1)!.Value;
        single.Should().BeApproximately(0.885, 0.001);

        var crate = ProductWeightCalculator.Compute(ProductKind.Bottle, 0.5, 20)!.Value;
        crate.Should().BeGreaterThan(single * 20);
    }

    [Fact]
    public void LegacyTenLitreEncoding_StillWeighsOneCrate()
    {
        // Rows predating the column encoded package size as the crate's total volume.
        ProductWeightCalculator.Compute(ProductKind.Bottle, BottleSize.TenLiters)
            .Should().BeApproximately(19.7, 0.001);
    }

    [Fact]
    public void EveryContainerSizeInUse_HasAWeight()
    {
        // Sizes the seeders actually produce. A new size added to a builder without a matching
        // weight entry contributes nothing silently, which is how 38% of delivered lines on dev
        // came to weigh zero.
        var inUse = new (ProductKind Kind, double Size)[]
        {
            (ProductKind.Bottle, BottleSize.ZeroPointThreeThreeLiters),
            (ProductKind.Bottle, BottleSize.ZeroPointFiveLiters),
            (ProductKind.Bottle, BottleSize.OneLiter),
            (ProductKind.Bottle, BottleSize.TwoLiters),
            (ProductKind.Multipack, BottleSize.ZeroPointFiveLiters),
            (ProductKind.Multipack, BottleSize.OneLiter),
            (ProductKind.Keg, KegSize.FiveLiters),
            (ProductKind.Keg, KegSize.FifteenLiters),
            (ProductKind.Keg, KegSize.TwentyLiters),
            (ProductKind.Keg, KegSize.ThirtyLiters),
            (ProductKind.Keg, KegSize.FiftyLiters),
            (ProductKind.Can, CanSize.ZeroPointThreeThreeLiters),
            (ProductKind.Can, CanSize.ZeroPointFiveLiters),
            (ProductKind.Can, CanSize.TwoLiters),
        };

        inUse
            .Where(x => ProductWeightCalculator.Compute(x.Kind, x.Size) is null or 0)
            .Should().BeEmpty();
    }

    [Fact]
    public void FiveLitreKeg_WeighsFiveNotTwo()
    {
        // PackageWeight's five-kilo constant was defined as 2, contradicting its own name.
        ProductWeightCalculator.Compute(ProductKind.Keg, KegSize.FiveLiters).Should().Be(5.0);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    public void NonPositiveUnitCount_IsTreatedAsOne(int units)
    {
        // Rows written before the column existed may carry 0.
        ProductWeightCalculator.Compute(ProductKind.Keg, KegSize.FiftyLiters, units).Should().Be(62.0);
    }

    [Fact]
    public void UnknownSizeOrMissingSize_HasNoWeight()
    {
        ProductWeightCalculator.Compute(ProductKind.Keg, null).Should().BeNull();
        ProductWeightCalculator.Compute(ProductKind.Other, null).Should().BeNull();
        ProductWeightCalculator.Compute(ProductKind.Other, 1.0).Should().BeNull();
        ProductWeightCalculator.Compute(ProductKind.Keg, 7.0).Should().BeNull();
    }

    [Fact]
    public void ProductWeight_UsesItsOwnUnitCount()
    {
        var crate = new Product
        {
            Kind = ProductKind.Bottle, PackageSize = BottleSize.ZeroPointFiveLiters, UnitsPerPackage = 20,
        };
        crate.Weight.Should().BeApproximately(19.7, 0.001);

        var keg = new Product { Kind = ProductKind.Keg, PackageSize = KegSize.FiftyLiters };
        keg.Weight.Should().Be(62.0);
    }

    [Fact]
    public void ProductUnitsPerPackage_DefaultsToOne()
    {
        new Product().UnitsPerPackage.Should().Be(1);
    }

    [Theory]
    [InlineData(ProductKind.Keg, KegSize.FiftyLiters, 1, 2, 124.0)]
    [InlineData(ProductKind.Can, CanSize.ZeroPointFiveLiters, 1, 24, 12.0)]
    public void ComputeLineWeightKg_MultipliesByQuantity(
        ProductKind kind, double size, int units, int quantity, decimal expected)
    {
        ProductWeightCalculator.ComputeLineWeightKg(kind, size, quantity, units).Should().Be(expected);
    }

    [Fact]
    public void ComputeLineWeightKg_TreatsAnUnknownContainerAsZero()
    {
        ProductWeightCalculator.ComputeLineWeightKg(ProductKind.Other, 1.0, 100).Should().Be(0m);
    }
}
