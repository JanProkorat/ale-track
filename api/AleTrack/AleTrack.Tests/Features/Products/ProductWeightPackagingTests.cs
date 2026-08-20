using AleTrack.Common.Enums;
using AleTrack.Features.Products.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// Weighing from the explicit container/sale-unit pair rather than from <see cref="ProductKind"/>.
/// Two things the coarse kind could not express: a jug has a weight at all, and the crate tare
/// follows from the unit being a crate instead of from it holding six or more containers.
/// </summary>
public sealed class ProductWeightPackagingTests
{
    [Theory]
    [InlineData(ProductContainer.Keg, ProductSaleUnit.Single, KegSize.FiftyLiters, 1, 62.0)]
    [InlineData(ProductContainer.Keg, ProductSaleUnit.Single, KegSize.ThirtyLiters, 1, 42.0)]
    [InlineData(ProductContainer.Can, ProductSaleUnit.Single, CanSize.TwoLiters, 1, 2.0)]
    // 24 × 0.5 l tray of cans, no outer tare worth counting.
    [InlineData(ProductContainer.Can, ProductSaleUnit.Tray, CanSize.ZeroPointFiveLiters, 24, 12.0)]
    // 12 × 0.33 l tray — the size the old crate table would have got wrong.
    [InlineData(ProductContainer.Can, ProductSaleUnit.Tray, CanSize.ZeroPointThreeThreeLiters, 12, 3.96)]
    // 20 × 0.885 + 2.0 crate tare.
    [InlineData(ProductContainer.Bottle, ProductSaleUnit.Crate, BottleSize.ZeroPointFiveLiters, 20, 19.7)]
    // 8 × 0.885 + 0.15 multipack tare.
    [InlineData(ProductContainer.Bottle, ProductSaleUnit.Multipack, BottleSize.ZeroPointFiveLiters, 8, 7.23)]
    // Duopack of litre bottles: 2 × 1.6 + 0.15.
    [InlineData(ProductContainer.Bottle, ProductSaleUnit.Multipack, BottleSize.OneLiter, 2, 3.35)]
    public void Compute_WeighsFromTheContainerAndSaleUnit(
        ProductContainer container, ProductSaleUnit saleUnit, double volume, int units, double expected)
    {
        ProductWeightCalculator.Compute(container, saleUnit, volume, units)
            .Should().BeApproximately(expected, 0.001);
    }

    [Theory]
    // A jug is glassware: same figures as the equivalent bottle, which is what it physically is.
    [InlineData(BottleSize.OneLiter, 1.6)]
    [InlineData(BottleSize.TwoLiters, 2.8)]
    public void Compute_GivesAJugAWeight(double volume, double expected)
    {
        // Under the old model these rows were ProductKind.Bottle, so they weighed a bottle but were
        // grouped as a crate. The weight was never the broken half — losing it now would be a
        // regression in the Reporty totals.
        ProductWeightCalculator.Compute(ProductContainer.Jug, ProductSaleUnit.Single, volume, 1)
            .Should().BeApproximately(expected, 0.001);
    }

    [Fact]
    public void CrateTare_FollowsTheSaleUnitNotThePackCount()
    {
        // The old rule charged a crate only once a bottled unit held six or more. A part-filled
        // crate is still a crate, and this is the case that rule got wrong.
        ProductWeightCalculator
            .Compute(ProductContainer.Bottle, ProductSaleUnit.Crate, BottleSize.ZeroPointFiveLiters, 4)
            .Should().BeApproximately(4 * 0.885 + 2.0, 0.001);
    }

    [Fact]
    public void SingleBottle_CarriesNoCrateTare()
    {
        ProductWeightCalculator
            .Compute(ProductContainer.Bottle, ProductSaleUnit.Single, BottleSize.ZeroPointFiveLiters, 1)
            .Should().BeApproximately(0.885, 0.001);
    }

    [Fact]
    public void LegacyTenLitreEncoding_StillWeighsOneCrate()
    {
        // Rows predating the unit-count column encoded package size as the crate's total volume. The
        // migration maps them to a single unit precisely so this whole-crate figure is not charged a
        // second crate tare. Dropping the entry would silently zero their weight, which is the
        // failure mode that once left a large share of delivered lines weighing nothing.
        ProductWeightCalculator
            .Compute(ProductContainer.Bottle, ProductSaleUnit.Single, BottleSize.TenLiters, 1)
            .Should().BeApproximately(19.7, 0.001);
    }

    [Fact]
    public void UnknownOrMissingVolume_HasNoWeight()
    {
        ProductWeightCalculator.Compute(ProductContainer.Keg, ProductSaleUnit.Single, null)
            .Should().BeNull();
        ProductWeightCalculator.Compute(ProductContainer.Keg, ProductSaleUnit.Single, 7.0)
            .Should().BeNull();
        ProductWeightCalculator.Compute(ProductContainer.Other, ProductSaleUnit.Single, 1.0)
            .Should().BeNull();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    public void NonPositiveUnitCount_IsTreatedAsOne(int units)
    {
        ProductWeightCalculator
            .Compute(ProductContainer.Keg, ProductSaleUnit.Single, KegSize.FiftyLiters, units)
            .Should().Be(62.0);
    }

    [Fact]
    public void EveryContainerAndVolumeThePriceListsUse_HasAWeight()
    {
        // Taken from the sections of the Svijany 2026 and Rohozec 2024 lists. A volume the importer
        // can produce but the weight table cannot price contributes zero silently, which is how a
        // large share of delivered lines once came to weigh nothing.
        var inUse = new (ProductContainer Container, ProductSaleUnit SaleUnit, double Volume)[]
        {
            (ProductContainer.Keg, ProductSaleUnit.Single, KegSize.FifteenLiters),
            (ProductContainer.Keg, ProductSaleUnit.Single, KegSize.ThirtyLiters),
            (ProductContainer.Keg, ProductSaleUnit.Single, KegSize.FiftyLiters),
            (ProductContainer.Bottle, ProductSaleUnit.Crate, BottleSize.ZeroPointFiveLiters),
            (ProductContainer.Bottle, ProductSaleUnit.Crate, BottleSize.ZeroPointThreeThreeLiters),
            (ProductContainer.Bottle, ProductSaleUnit.Multipack, BottleSize.ZeroPointFiveLiters),
            (ProductContainer.Bottle, ProductSaleUnit.Multipack, BottleSize.OneLiter),
            (ProductContainer.Can, ProductSaleUnit.Tray, CanSize.ZeroPointFiveLiters),
            (ProductContainer.Can, ProductSaleUnit.Tray, CanSize.ZeroPointThreeThreeLiters),
            (ProductContainer.Can, ProductSaleUnit.Single, CanSize.TwoLiters),
            (ProductContainer.Jug, ProductSaleUnit.Single, BottleSize.OneLiter),
            (ProductContainer.Jug, ProductSaleUnit.Single, BottleSize.TwoLiters),
        };

        inUse
            .Where(x => ProductWeightCalculator.Compute(x.Container, x.SaleUnit, x.Volume) is null or 0)
            .Should().BeEmpty();
    }
}
