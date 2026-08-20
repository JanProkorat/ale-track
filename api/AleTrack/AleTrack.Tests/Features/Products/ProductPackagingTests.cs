using AleTrack.Common.Enums;
using AleTrack.Features.Products.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// Container and sale unit are recorded separately, and <see cref="ProductKind"/> is what the two
/// add up to. The case that motivated the split: a 2 l jug and a 20 × 0.5 l crate were both
/// <see cref="ProductKind.Bottle"/>, so the jug rendered as "Basa".
/// </summary>
public sealed class ProductPackagingTests
{
    [Theory]
    [InlineData(ProductContainer.Keg, ProductSaleUnit.Single, ProductKind.Keg)]
    [InlineData(ProductContainer.Bottle, ProductSaleUnit.Crate, ProductKind.Bottle)]
    [InlineData(ProductContainer.Can, ProductSaleUnit.Tray, ProductKind.Can)]
    [InlineData(ProductContainer.Can, ProductSaleUnit.Single, ProductKind.Can)]
    [InlineData(ProductContainer.Bottle, ProductSaleUnit.Multipack, ProductKind.Multipack)]
    [InlineData(ProductContainer.Can, ProductSaleUnit.Multipack, ProductKind.Multipack)]
    [InlineData(ProductContainer.Other, ProductSaleUnit.Single, ProductKind.Other)]
    public void DeriveKind_MapsThePackagingPairOntoTheCoarseKind(
        ProductContainer container, ProductSaleUnit saleUnit, ProductKind expected)
    {
        ProductPackaging.DeriveKind(container, saleUnit).Should().Be(expected);
    }

    [Fact]
    public void DeriveKind_NeverCallsAJugABottle()
    {
        // The whole reason the pair exists: ProductKind.Bottle renders as "Basa", and a decorative
        // jug is not a crate. Any kind but Bottle is acceptable here; Bottle is the bug.
        ProductPackaging.DeriveKind(ProductContainer.Jug, ProductSaleUnit.Single)
            .Should().NotBe(ProductKind.Bottle);
    }

    [Fact]
    public void DeriveKind_TreatsACrateAsBottledEvenWhenTheContainerIsACan()
    {
        // Defensive: no brewery crates cans, but "sold as a crate" is what drives the Basa grouping,
        // so the sale unit has to win over the container for that one kind.
        ProductPackaging.DeriveKind(ProductContainer.Can, ProductSaleUnit.Crate)
            .Should().Be(ProductKind.Bottle);
    }
}
