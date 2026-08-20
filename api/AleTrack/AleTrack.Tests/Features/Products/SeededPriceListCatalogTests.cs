using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;
using AleTrack.Seeding.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// Guards the committed brewery price lists and the builders that read them. A transcription slip
/// here is a wrong price in every order, invoice and report drawn from a seeded database, and
/// nothing else would catch it — the parser is happy with any well-formed number.
/// </summary>
public sealed class SeededPriceListCatalogTests
{
    private static List<Product> SvijanyCatalogueProducts() =>
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
    ];

    private static List<Product> RohozecCatalogueProducts() =>
    [
        .. RohozecProductsBuilder.GetRohozecKegProducts(),
        .. RohozecProductsBuilder.GetRohozecBottleProducts(),
        .. RohozecProductsBuilder.GetRohozecCanProducts(),
    ];

    private static (string, ProductContainer, double?, ProductSaleUnit, int) Key(Product product) =>
        (product.Name, product.Container, product.PackageSize, product.SaleUnit, product.UnitsPerPackage);

    private static Product Find(
        IEnumerable<Product> products, string name, ProductContainer container, double volume) =>
        products.Single(p => p.Name == name && p.Container == container && p.PackageSize == volume);

    [Fact]
    public void SvijanySectionMethods_CoverEveryRowOfTheCatalogueExactlyOnce()
    {
        // The builder methods are filters over one file. A row matching no filter would vanish from
        // the seed in silence, and a row matching two would be seeded twice.
        var products = SvijanyCatalogueProducts();
        var rows = SeedingCatalog.Rows("svijany-2026-05-01.csv");

        products.Select(Key).Should().OnlyHaveUniqueItems();
        products.Should().HaveCount(rows.Count);
    }

    [Fact]
    public void RohozecSectionMethods_CoverEveryRowOfTheCatalogueExactlyOnce()
    {
        var products = RohozecCatalogueProducts();
        var rows = SeedingCatalog.Rows("rohozec-2024-05-01.csv");

        products.Select(Key).Should().OnlyHaveUniqueItems();
        products.Should().HaveCount(rows.Count);
    }

    [Fact]
    public void SvijanskaDesitka_CarriesThe2026ListsCratePrice()
    {
        // The number this whole change exists for: the seeder priced the crate at 296,00 Kč
        // (12,23 Kč per 0,5 l) while the brewery's list valid from 1 May 2026 says 318,00 Kč.
        var crate = Find(SvijanyProductsBuilder.GetSampleBottledProducts(),
            "Svijanská Desítka", ProductContainer.Bottle, BottleSize.ZeroPointFiveLiters);

        crate.PriceWithVat.Should().Be(318.00m);
        crate.PriceForUnitWithoutVat.Should().Be(13.14m);
        crate.PriceForUnitWithVat.Should().Be(15.90m);
        crate.UnitsPerPackage.Should().Be(20);
        crate.SaleUnit.Should().Be(ProductSaleUnit.Crate);
    }

    [Fact]
    public void SvijanyKegs_CarryBothThePerHalfLitreAndThePerKegPrice()
    {
        // The lists print two figures for a keg and the entity keeps both; deriving either would
        // disagree with the page by a haléř.
        var keg = Find(SvijanyProductsBuilder.GetSampleKegProducts(),
            "Svijanská Desítka", ProductContainer.Keg, KegSize.FiftyLiters);

        keg.PriceForUnitWithoutVat.Should().Be(15.37m);
        keg.PriceForUnitWithVat.Should().Be(18.60m);
        keg.PriceWithoutVat.Should().Be(1537.19m);
        keg.PriceWithVat.Should().Be(1860.00m);
    }

    [Fact]
    public void RohozecProducts_KeepThePublicIdsTheBuilderUsedToHandOut()
    {
        // Reading them from a file would otherwise mint fresh GUIDs on every seed, quietly detaching
        // every Rohozec product from anything that referenced it.
        var kegs = RohozecProductsBuilder.GetRohozecKegProducts();

        Find(kegs, "Roh. Nealko", ProductContainer.Keg, KegSize.ThirtyLiters).PublicId
            .Should().Be(Guid.Parse("a0000000-0000-0000-0000-000000000001"));
        Find(kegs, "Roh. Skalák", ProductContainer.Keg, KegSize.FiftyLiters).PublicId
            .Should().Be(Guid.Parse("a0000000-0000-0000-0000-000000000007"));

        RohozecCatalogueProducts().Select(p => p.PublicId).Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public void RohozecCans_AreATrayOfTwelveRatherThanASingleCan()
    {
        // The 2024 list states "Tray = 12 ks plechovek 0,5 l"; the count used to be absent, which
        // left a tray weighing one can.
        var can = Find(RohozecProductsBuilder.GetRohozecCanProducts(),
            "Roh. Skalák", ProductContainer.Can, CanSize.ZeroPointFiveLiters);

        can.SaleUnit.Should().Be(ProductSaleUnit.Tray);
        can.UnitsPerPackage.Should().Be(12);
        can.PriceWithVat.Should().Be(258.00m);
        can.PriceForUnitWithVat.Should().Be(21.50m);
    }

    [Fact]
    public void SvijanyTwoLitreProducts_AreSplitBetweenCansAndJugs()
    {
        // "2 l" names two different products on this list: a genuine can priced za kus, and a
        // decorative jug. Conflating them is what made a jug display as a crate.
        var cans = SvijanyProductsBuilder.GetSampleTwoLiterCanProducts();
        var jugs = SvijanyProductsBuilder.GetSampleDecorativeBottleProducts();

        cans.Should().OnlyContain(p => p.Container == ProductContainer.Can && p.PackageSize == 2.0);
        Find(cans, "Svijanský Máz", ProductContainer.Can, 2.0).PriceWithVat.Should().Be(145.00m);
        Find(jugs, "Svijanský Kvasničák", ProductContainer.Jug, 2.0).PriceWithVat.Should().Be(490.00m);
    }

    [Fact]
    public void EveryCataloguePrice_IsPositiveAndTheUnitPriceNeverExceedsThePack()
    {
        // Catches a column read one place to the left, which is the transcription slip a plausible
        // number would otherwise survive.
        var products = SvijanyCatalogueProducts().Concat(RohozecCatalogueProducts()).ToList();

        products.Should().OnlyContain(p => p.PriceWithVat > 0m);
        products.Should().OnlyContain(p => p.PriceWithoutVat > 0m && p.PriceWithoutVat < p.PriceWithVat);
        products
            .Where(p => p.PriceForUnitWithVat > p.PriceWithVat)
            .Select(p => $"{p.Name} {p.Container} {p.PackageSize} l")
            .Should().BeEmpty();
    }
}
