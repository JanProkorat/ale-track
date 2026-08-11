using AleTrack.Common.Enums;
using AleTrack.Features.Products.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// One case per branch of the <c>AddProductPackaging</c> backfill. These are deliberately the same
/// cases the migration's SQL was verified against, so the two definitions of the mapping cannot
/// drift apart — a row seeded in the old shape and a row migrated from the old shape must land on
/// the same packaging.
/// </summary>
public sealed class ProductPackagingLegacyShapeTests
{
    [Theory]
    [InlineData(ProductKind.Keg, 50.0, 1, "Máz", ProductContainer.Keg, ProductSaleUnit.Single)]
    [InlineData(ProductKind.Keg, 30.0, 1, "Máz", ProductContainer.Keg, ProductSaleUnit.Single)]
    [InlineData(ProductKind.Bottle, 0.5, 20, "Desítka", ProductContainer.Bottle, ProductSaleUnit.Crate)]
    [InlineData(ProductKind.Bottle, 0.33, 24, "Desítka", ProductContainer.Bottle, ProductSaleUnit.Crate)]
    [InlineData(ProductKind.Bottle, 0.75, 1, "Speciál", ProductContainer.Bottle, ProductSaleUnit.Single)]
    // A 1 l or 2 l "bottle" is decorative glassware, never crated — the case that made a džbán
    // render as "Basa".
    [InlineData(ProductKind.Bottle, 1.0, 1, "Fanda 1L", ProductContainer.Jug, ProductSaleUnit.Single)]
    [InlineData(ProductKind.Bottle, 2.0, 1, "Kvasničák 2L", ProductContainer.Jug, ProductSaleUnit.Single)]
    // The superseded encoding that held a crate's total volume; left a single unit so the weight
    // table's whole-crate figure is not charged a second crate tare.
    [InlineData(ProductKind.Bottle, 10.0, 1, "Staré", ProductContainer.Bottle, ProductSaleUnit.Single)]
    [InlineData(ProductKind.Can, 0.5, 24, "Shine", ProductContainer.Can, ProductSaleUnit.Tray)]
    [InlineData(ProductKind.Can, 0.33, 12, "Shine", ProductContainer.Can, ProductSaleUnit.Tray)]
    [InlineData(ProductKind.Can, 0.5, 1, "Shine", ProductContainer.Can, ProductSaleUnit.Single)]
    [InlineData(ProductKind.Can, 2.0, 1, "Máz 2L", ProductContainer.Can, ProductSaleUnit.Single)]
    [InlineData(ProductKind.Multipack, 0.5, 8, "Máz 8x", ProductContainer.Bottle, ProductSaleUnit.Multipack)]
    // A multipack's container is recorded nowhere; the name is the only evidence, and it only ever
    // says so for cans.
    [InlineData(ProductKind.Multipack, 0.5, 6, "Máz plech 6x", ProductContainer.Can, ProductSaleUnit.Multipack)]
    [InlineData(ProductKind.Other, null, 1, "Sklenice", ProductContainer.Other, ProductSaleUnit.Single)]
    public void FromLegacyShape_MatchesTheMigrationBackfill(
        ProductKind kind, double? packageSize, int unitsPerPackage, string name,
        ProductContainer expectedContainer, ProductSaleUnit expectedSaleUnit)
    {
        ProductPackaging.FromLegacyShape(kind, packageSize, unitsPerPackage, name)
            .Should().Be((expectedContainer, expectedSaleUnit));
    }

    [Fact]
    public void FromLegacyShape_NeverReturnsAnUndefinedEnumValue()
    {
        // The migration's CASE expressions each end in a catch-all so no row keeps the invalid 0
        // the added columns default to. The same has to hold here.
        var shapes =
            from kind in Enum.GetValues<ProductKind>()
            from size in (double?[])[null, 0.33, 0.5, 0.75, 1.0, 2.0, 10.0, 30.0, 50.0, 7.0]
            from units in (int[])[1, 6, 20, 24]
            select ProductPackaging.FromLegacyShape(kind, size, units, "Test");

        shapes.Should().OnlyContain(s =>
            Enum.IsDefined(s.Container) && Enum.IsDefined(s.SaleUnit));
    }
}
