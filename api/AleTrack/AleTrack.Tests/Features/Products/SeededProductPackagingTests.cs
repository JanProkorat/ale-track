using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;
using AleTrack.Seeding.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// Guards the seeded catalogue against the failure that has already happened once: a product whose
/// container the weight table does not price contributes nothing to a delivered-line weight, in
/// silence, and understates every figure in the Reporty module.
/// </summary>
public sealed class SeededProductPackagingTests
{
    private static List<Product> AllSeededProducts()
    {
        List<Product> products =
        [
            .. SvijanyProductsBuilder.GetSampleBottledProducts(),
            .. SvijanyProductsBuilder.GetSampleKegProducts(),
            .. SvijanyProductsBuilder.GetSampleLimoKegProducts(),
            .. SvijanyProductsBuilder.GetSampleMultipackProducts(),
            .. SvijanyProductsBuilder.GetSampleCanZeroPointFiveProducts(),
            .. SvijanyProductsBuilder.GetSampleCanZeroPointThreeProducts(),
            .. SvijanyProductsBuilder.GetSampleTwoLiterCanProducts(),
            .. SvijanyProductsBuilder.GetSampleFiveLiterKegProducts(),
            .. SvijanyProductsBuilder.GetSampleDecorativeBottleProducts(),
            .. SvijanyProductsBuilder.GetSampleDuoPackProducts(),
            .. SvijanyProductsBuilder.GetSampleOtherProducts(),
            .. RohozecProductsBuilder.GetRohozecKegProducts(),
            .. RohozecProductsBuilder.GetRohozecBottleProducts(),
            .. RohozecProductsBuilder.GetRohozecCanProducts(),
            .. PrimatorProductsBuilder.GetPrimatorKegProducts(),
            .. PrimatorProductsBuilder.GetPrimatorBottleProducts(),
            .. PrimatorProductsBuilder.GetPrimatorMultipackProducts(),
            .. PrimatorProductsBuilder.GetPrimatorCanProducts(),
        ];

        SeedingProductPackaging.Fill(products);
        return products;
    }

    // There is deliberately no "every product has a defined enum value" test here: the entity's
    // property defaults are themselves valid members, so such a test cannot fail in C# whatever the
    // fill does. That invariant only has teeth against the database, where the added columns default
    // to an invalid 0, and it is asserted there against the migration's backfill instead.

    [Fact]
    public void EverySeededDrink_HasAWeight()
    {
        // Merchandise has no container and legitimately has no weight; everything that holds beer
        // must have one.
        var drinks = AllSeededProducts()
            .Where(p => p.Container != ProductContainer.Other)
            .ToList();

        // Without this the assertion below passes on an empty set: if the packaging fill were
        // skipped every product would default to Other and be filtered out, and the test would
        // report success while proving nothing.
        drinks.Should().HaveCountGreaterThan(100);

        drinks
            .Where(p => p.Weight is null or 0)
            .Select(p => $"{p.Name} ({p.Container}/{p.SaleUnit} {p.PackageSize} l × {p.UnitsPerPackage})")
            .Should().BeEmpty();
    }

    [Fact]
    public void EverySeededProduct_KindAgreesWithItsPackaging()
    {
        AllSeededProducts().Should().OnlyContain(p =>
            p.Kind == ProductPackaging.DeriveKind(p.Container, p.SaleUnit));
    }

    [Fact]
    public void SeededCatalogue_StillCoversEveryPackagingShapeTheBreweriesSell()
    {
        // A fixture that quietly stopped producing, say, jugs would leave the packaging rework
        // untested against real data while every other assertion here still passed.
        var shapes = AllSeededProducts()
            .Select(p => (p.Container, p.SaleUnit))
            .Distinct()
            .ToList();

        shapes.Should().Contain((ProductContainer.Keg, ProductSaleUnit.Single));
        shapes.Should().Contain((ProductContainer.Bottle, ProductSaleUnit.Crate));
        shapes.Should().Contain((ProductContainer.Can, ProductSaleUnit.Single));
        shapes.Should().Contain((ProductContainer.Jug, ProductSaleUnit.Single));
        shapes.Should().Contain((ProductContainer.Bottle, ProductSaleUnit.Multipack));
    }

    [Fact]
    public void TheTwoLitreProducts_AreNoLongerBothFiledAsCrates()
    {
        // Svijany sells a 2 l can ("PLECHOVKY 2L") and a 2 l decorative jug ("DEKORATIVNÍ LAHVE,
        // DŽBÁNY"). Under the old model both were ProductKind.Bottle, which renders as "Basa".
        var twoLitre = AllSeededProducts().Where(p => p.PackageSize == 2.0).ToList();

        twoLitre.Should().NotBeEmpty();
        twoLitre.Should().OnlyContain(p => p.SaleUnit != ProductSaleUnit.Crate);
        twoLitre.Select(p => p.Container).Distinct().Should()
            .BeSubsetOf([ProductContainer.Can, ProductContainer.Jug]);
    }
}
