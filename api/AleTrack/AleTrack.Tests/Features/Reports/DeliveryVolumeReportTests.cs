using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.Reports;

public sealed class ProductWeightCalculatorTests
{
    [Theory]
    [InlineData(ProductKind.Keg, KegSize.FiftyLiters, PackageWeight.SixtyTwoKilos)]
    [InlineData(ProductKind.Keg, KegSize.ThirtyLiters, PackageWeight.FortyTwoKilos)]
    [InlineData(ProductKind.Bottle, BottleSize.OneLiter, PackageWeight.OneKilo)]
    [InlineData(ProductKind.Can, CanSize.ZeroPointFiveLiters, PackageWeight.ZeroPointFive)]
    public void Compute_ReturnsWeight_ForKnownKindAndSize(ProductKind kind, double size, double expected)
    {
        ProductWeightCalculator.Compute(kind, size).Should().Be(expected);
    }

    [Fact]
    public void Compute_ReturnsNull_WhenPackageSizeMissing()
    {
        ProductWeightCalculator.Compute(ProductKind.Keg, null).Should().BeNull();
    }

    [Fact]
    public void Compute_ReturnsNull_ForUnknownCombination()
    {
        ProductWeightCalculator.Compute(ProductKind.Multipack, 6).Should().BeNull();
    }

    [Fact]
    public void ProductWeight_DelegatesToCalculator()
    {
        var product = new Product { Kind = ProductKind.Keg, PackageSize = KegSize.FiftyLiters };
        product.Weight.Should().Be(ProductWeightCalculator.Compute(ProductKind.Keg, KegSize.FiftyLiters));
    }
}
