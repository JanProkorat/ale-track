using AleTrack.Common.Enums;
using AleTrack.Features.Products.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// A unit is one sellable package, and for a bottled product that package is a crate ("Basa"),
/// not a bottle. A missing entry costs nothing loudly — it silently returns 0 kg and understates
/// every weight figure in the Reporty module.
/// </summary>
public sealed class ProductWeightCalculatorTests
{
    [Theory]
    // Crates: bottles plus the crate itself.
    [InlineData(ProductKind.Bottle, 0.33, 17.0)]
    [InlineData(ProductKind.Bottle, 0.5, 20.0)]
    [InlineData(ProductKind.Bottle, 10.0, 20.0)]
    // Decorative bottles, sold singly.
    [InlineData(ProductKind.Bottle, 1.0, 1.0)]
    [InlineData(ProductKind.Bottle, 2.0, 2.0)]
    // Kegs, gross.
    [InlineData(ProductKind.Keg, 5.0, 5.0)]
    [InlineData(ProductKind.Keg, 15.0, 20.0)]
    [InlineData(ProductKind.Keg, 20.0, 20.0)]
    [InlineData(ProductKind.Keg, 30.0, 42.0)]
    [InlineData(ProductKind.Keg, 50.0, 62.0)]
    // Cans, individual.
    [InlineData(ProductKind.Can, 0.33, 0.33)]
    [InlineData(ProductKind.Can, 0.5, 0.5)]
    [InlineData(ProductKind.Can, 2.0, 2.0)]
    public void Compute_ReturnsTheGrossPackageWeight(ProductKind kind, double packageSize, double expected)
    {
        ProductWeightCalculator.Compute(kind, packageSize).Should().Be(expected);
    }

    [Fact]
    public void EveryPackageSizeInUse_HasAWeight()
    {
        // The sizes the seeders actually produce. A new size added to a builder without a matching
        // weight entry silently contributes nothing, which is how 38% of delivered lines came to
        // weigh zero.
        var inUse = new (ProductKind Kind, double Size)[]
        {
            (ProductKind.Bottle, 0.33), (ProductKind.Bottle, 0.5),
            (ProductKind.Bottle, 1.0), (ProductKind.Bottle, 2.0),
            (ProductKind.Keg, 5.0), (ProductKind.Keg, 15.0), (ProductKind.Keg, 20.0),
            (ProductKind.Keg, 30.0), (ProductKind.Keg, 50.0),
            (ProductKind.Can, 0.33), (ProductKind.Can, 0.5), (ProductKind.Can, 2.0),
        };

        var missing = inUse
            .Where(x => ProductWeightCalculator.Compute(x.Kind, x.Size) is null or 0)
            .ToList();

        missing.Should().BeEmpty();
    }

    [Fact]
    public void FiveLitreKeg_WeighsFiveNotTwo()
    {
        // PackageWeight.FiveKilos was defined as 2, contradicting its name.
        ProductWeightCalculator.Compute(ProductKind.Keg, 5.0).Should().Be(5.0);
    }

    [Fact]
    public void BottledCrate_OutweighsASingleCan()
    {
        // A crate of 20 must never come out lighter than one can — the symptom of the missing
        // 0.5 l bottle entry, which made 3311 bottled units weigh nothing at all.
        var crate = ProductWeightCalculator.Compute(ProductKind.Bottle, 0.5)!.Value;
        var can = ProductWeightCalculator.Compute(ProductKind.Can, 0.5)!.Value;

        crate.Should().BeGreaterThan(can);
    }

    [Fact]
    public void Multipack_HasNoWeightYet()
    {
        // Documents a known gap rather than blessing it: pack count (6/7/8) lives only in the
        // product name, so a size-keyed lookup cannot be right for all of them. Delete this test
        // when the model carries units-per-package.
        ProductWeightCalculator.Compute(ProductKind.Multipack, 0.5).Should().BeNull();
        ProductWeightCalculator.Compute(ProductKind.Multipack, 1.0).Should().BeNull();
    }

    [Fact]
    public void NullPackageSize_HasNoWeight()
    {
        ProductWeightCalculator.Compute(ProductKind.Other, null).Should().BeNull();
        ProductWeightCalculator.Compute(ProductKind.Keg, null).Should().BeNull();
    }

    [Theory]
    [InlineData(ProductKind.Bottle, 0.5, 3, 60.0)]
    [InlineData(ProductKind.Keg, 50.0, 2, 124.0)]
    [InlineData(ProductKind.Can, 0.5, 24, 12.0)]
    public void ComputeLineWeightKg_MultipliesByQuantity(
        ProductKind kind, double packageSize, int quantity, decimal expected)
    {
        ProductWeightCalculator.ComputeLineWeightKg(kind, packageSize, quantity).Should().Be(expected);
    }

    [Fact]
    public void ComputeLineWeightKg_TreatsAnUnknownPackageAsZero()
    {
        ProductWeightCalculator.ComputeLineWeightKg(ProductKind.Multipack, 0.5, 100).Should().Be(0m);
    }
}
