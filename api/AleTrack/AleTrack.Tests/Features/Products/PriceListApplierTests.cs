using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Breweries.Utils;
using AleTrack.Features.Products.Import;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// Writing a diff onto the product graph, and the provenance row that records it having happened.
/// Kept separate from the endpoint tests because the applier takes its timestamp as an argument —
/// which is the only reason the recorded time is assertable at all.
/// </summary>
public sealed class PriceListApplierTests
{
    private static readonly DateOnly EffectiveFrom = new(2026, 5, 1);
    private static readonly DateTimeOffset ImportedAt = new(2026, 8, 11, 9, 30, 0, TimeSpan.Zero);

    private static PriceListRow Row(
        string name = "Bidlovka",
        ProductContainer container = ProductContainer.Keg,
        double? volume = 30,
        ProductSaleUnit saleUnit = ProductSaleUnit.Single,
        int units = 1,
        Guid? publicId = null) => new()
    {
        PublicId = publicId,
        Name = name,
        Type = ProductType.PaleLager,
        Container = container,
        VolumeLiters = volume,
        SaleUnit = saleUnit,
        UnitsPerPackage = units,
        AlcoholPercentage = 5.0f,
        PlatoDegree = null,
        PackPriceWithVat = 1506.00m,
        PackPriceWithoutVat = 1244.40m,
        UnitPriceWithVat = 25.10m,
        UnitPriceWithoutVat = 20.74m,
        Derived = PriceDerivation.None,
        Line = 3
    };

    private static PriceListApplyOutcome Apply(Brewery brewery, params PriceListDiffEntry[] entries) =>
        PriceListApplier.Apply(
            brewery, entries, EffectiveFrom, ImportedAt, "abc123", "pivovarsvijany.cz/file/2336", 42);

    [Fact]
    public void Apply_AddedRow_CreatesAProductWithPackagingAndProvenance()
    {
        var brewery = BreweryBuilder.BuildEntity();

        Apply(brewery, new PriceListDiffEntry
        {
            Kind = PriceListChangeKind.Added,
            Name = "Bidlovka",
            Row = Row()
        });

        var product = brewery.Products.Should().ContainSingle().Subject;
        product.Name.Should().Be("Bidlovka");
        product.Container.Should().Be(ProductContainer.Keg);
        product.SaleUnit.Should().Be(ProductSaleUnit.Single);
        // Derived, never taken from the file — the grouping and reporting queries key on it.
        product.Kind.Should().Be(ProductKind.Keg);
        product.PriceWithVat.Should().Be(1506.00m);
        product.PriceEffectiveFrom.Should().Be(EffectiveFrom);
        product.PublicId.Should().NotBeEmpty();
    }

    [Fact]
    public void Apply_AddedRowCarryingAPublicId_KeepsIt()
    {
        var brewery = BreweryBuilder.BuildEntity();
        var pinned = Guid.Parse("a0000000-0000-0000-0000-000000000007");

        Apply(brewery, new PriceListDiffEntry
        {
            Kind = PriceListChangeKind.Added,
            Name = "Bidlovka",
            Row = Row(publicId: pinned)
        });

        brewery.Products.Single().PublicId.Should().Be(pinned);
    }

    [Fact]
    public void Apply_UnchangedRow_StillRecordsWhichListConfirmedThePrice()
    {
        var product = ProductBuilder.BuildEntity(name: "Bidlovka", container: ProductContainer.Keg,
            saleUnit: ProductSaleUnit.Single, packageSize: 30, unitsPerPackage: 1);
        var brewery = BreweryBuilder.BuildEntity();
        brewery.Products.Add(product);

        var outcome = Apply(brewery, new PriceListDiffEntry
        {
            Kind = PriceListChangeKind.Unchanged,
            Name = "Bidlovka",
            Existing = State(product),
            Row = Row()
        });

        product.PriceEffectiveFrom.Should().Be(EffectiveFrom);
        // Confirming a price is not changing one.
        outcome.Import.UpdatedCount.Should().Be(0);
    }

    [Fact]
    public void Apply_BlockedProduct_IsLeftEntirelyAlone()
    {
        var product = ProductBuilder.BuildEntity(name: "Zámek", priceWithVat: 1344.00m);
        var brewery = BreweryBuilder.BuildEntity();
        brewery.Products.Add(product);

        var outcome = Apply(brewery, new PriceListDiffEntry
        {
            Kind = PriceListChangeKind.Blocked,
            Name = "Zámek",
            Existing = State(product)
        });

        outcome.Removed.Should().BeEmpty();
        outcome.Import.RemovedCount.Should().Be(0);
        product.PriceWithVat.Should().Be(1344.00m);
        product.PriceEffectiveFrom.Should().BeNull();
        brewery.Products.Should().Contain(product);
    }

    [Fact]
    public void Apply_WritesAProvenanceRowCarryingTheTimestampItWasGiven()
    {
        var brewery = BreweryBuilder.BuildEntity();

        var outcome = Apply(brewery,
            new PriceListDiffEntry { Kind = PriceListChangeKind.Added, Name = "Bidlovka", Row = Row() },
            new PriceListDiffEntry { Kind = PriceListChangeKind.Added, Name = "Svátek", Row = Row(name: "Svátek") });

        var import = outcome.Import;
        import.ImportedAt.Should().Be(ImportedAt);
        import.EffectiveFrom.Should().Be(EffectiveFrom);
        import.SourceHash.Should().Be("abc123");
        import.SourceName.Should().Be("pivovarsvijany.cz/file/2336");
        import.ImportedByUserId.Should().Be(42);
        import.AddedCount.Should().Be(2);
        import.UpdatedCount.Should().Be(0);
        import.RemovedCount.Should().Be(0);
        import.Brewery.Should().BeSameAs(brewery);
    }

    private static PriceListProductState State(Product product) => new()
    {
        PublicId = product.PublicId,
        Name = product.Name,
        Type = product.Type,
        Container = product.Container,
        SaleUnit = product.SaleUnit,
        VolumeLiters = product.PackageSize,
        UnitsPerPackage = product.UnitsPerPackage,
        AlcoholPercentage = product.AlcoholPercentage,
        PlatoDegree = product.PlatoDegree,
        PriceWithVat = product.PriceWithVat,
        PriceWithoutVat = product.PriceWithoutVat,
        PriceForUnitWithVat = product.PriceForUnitWithVat,
        PriceForUnitWithoutVat = product.PriceForUnitWithoutVat,
        IsInUse = false
    };
}
