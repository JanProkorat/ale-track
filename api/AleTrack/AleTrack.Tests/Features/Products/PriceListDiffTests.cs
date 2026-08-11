using AleTrack.Common.Enums;
using AleTrack.Features.Products.Import;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// Matching and bucketing. Both are load-bearing: a normalisation miss reports the whole catalogue
/// as new and proposes deleting all of it, and a bucket that swallows a change hides a price move
/// behind an "unchanged" row nobody looks at.
/// </summary>
public sealed class PriceListDiffTests
{
    private static PriceListRow Row(
        string name = "Svijanská Desítka",
        ProductType type = ProductType.PaleDraftBeer,
        ProductContainer container = ProductContainer.Bottle,
        double? volume = 0.5,
        ProductSaleUnit saleUnit = ProductSaleUnit.Crate,
        int units = 20,
        float? alcohol = 4.0f,
        float? plato = 10f,
        decimal packWithVat = 318.00m,
        decimal? packWithoutVat = 262.81m,
        decimal? unitWithVat = 15.90m,
        decimal? unitWithoutVat = 13.14m) => new()
    {
        Name = name,
        Type = type,
        Container = container,
        VolumeLiters = volume,
        SaleUnit = saleUnit,
        UnitsPerPackage = units,
        AlcoholPercentage = alcohol,
        PlatoDegree = plato,
        PackPriceWithVat = packWithVat,
        PackPriceWithoutVat = packWithoutVat,
        UnitPriceWithVat = unitWithVat,
        UnitPriceWithoutVat = unitWithoutVat,
        Derived = PriceDerivation.None,
        Line = 2
    };

    private static PriceListProductState Stored(
        string name = "Svijanská Desítka",
        ProductType type = ProductType.PaleDraftBeer,
        ProductContainer container = ProductContainer.Bottle,
        double? volume = 0.5,
        ProductSaleUnit saleUnit = ProductSaleUnit.Crate,
        int units = 20,
        float? alcohol = 4.0f,
        float? plato = 10f,
        decimal priceWithVat = 318.00m,
        decimal? priceWithoutVat = 262.81m,
        decimal? unitWithVat = 15.90m,
        decimal? unitWithoutVat = 13.14m,
        bool isInUse = false) => new()
    {
        PublicId = Guid.NewGuid(),
        Name = name,
        Type = type,
        Container = container,
        VolumeLiters = volume,
        SaleUnit = saleUnit,
        UnitsPerPackage = units,
        AlcoholPercentage = alcohol,
        PlatoDegree = plato,
        PriceWithVat = priceWithVat,
        PriceWithoutVat = priceWithoutVat,
        PriceForUnitWithVat = unitWithVat,
        PriceForUnitWithoutVat = unitWithoutVat,
        IsInUse = isInUse
    };

    [Fact]
    public void Compute_ProductAbsentFromTheDatabase_IsAdded()
    {
        var diff = PriceListDiff.Compute([Row(name: "Bidlovka")], [Stored()]);

        diff.Single(e => e.Name == "Bidlovka").Kind.Should().Be(PriceListChangeKind.Added);
    }

    [Fact]
    public void Compute_OnlyPricesDiffer_IsRepriced()
    {
        var diff = PriceListDiff.Compute([Row(packWithVat: 340.00m)], [Stored(priceWithVat: 318.00m)]);

        var entry = diff.Should().ContainSingle().Subject;
        entry.Kind.Should().Be(PriceListChangeKind.Repriced);
        entry.Changes.Should().ContainSingle(c => c.Field == nameof(PriceListProductState.PriceWithVat)
                                                  && c.Before == "318" && c.After == "340");
    }

    [Fact]
    public void Compute_ANonPriceFieldDiffers_IsChangedEvenWhenThePriceMovedToo()
    {
        // Otherwise a type correction rides along inside a "reprice" and nobody reviews it.
        var diff = PriceListDiff.Compute(
            [Row(type: ProductType.PaleLager, packWithVat: 340.00m)],
            [Stored(type: ProductType.PaleDraftBeer, priceWithVat: 318.00m)]);

        var entry = diff.Should().ContainSingle().Subject;
        entry.Kind.Should().Be(PriceListChangeKind.Changed);
        entry.Changes.Should().Contain(c => c.Field == nameof(PriceListProductState.Type));
        entry.Changes.Should().Contain(c => c.Field == nameof(PriceListProductState.PriceWithVat));
    }

    [Fact]
    public void Compute_NothingDiffers_IsUnchanged()
    {
        var diff = PriceListDiff.Compute([Row()], [Stored()]);

        var entry = diff.Should().ContainSingle().Subject;
        entry.Kind.Should().Be(PriceListChangeKind.Unchanged);
        entry.Changes.Should().BeEmpty();
    }

    [Fact]
    public void Compute_StoredProductTheListOmits_IsProposedForRemoval()
    {
        var diff = PriceListDiff.Compute([], [Stored(name: "Zámek", isInUse: false)]);

        diff.Should().ContainSingle().Which.Kind.Should().Be(PriceListChangeKind.ToRemove);
    }

    [Fact]
    public void Compute_OmittedProductStillInUse_IsBlockedRatherThanRemoved()
    {
        // Stock on hand or an open order line; either way the product still has to exist.
        var diff = PriceListDiff.Compute([], [Stored(name: "Zámek", isInUse: true)]);

        diff.Should().ContainSingle().Which.Kind.Should().Be(PriceListChangeKind.Blocked);
    }

    [Fact]
    public void Compute_ListPrintsTheDegreeInTheName_StillMatchesTheStoredProduct()
    {
        // The failure this guards: without normalisation the first import reports every product as
        // Added and every stored product as ToRemove.
        var diff = PriceListDiff.Compute([Row(name: "Svijanská Desítka 10%")], [Stored(name: "Svijanská Desítka")]);

        diff.Should().ContainSingle().Which.Kind.Should().Be(PriceListChangeKind.Unchanged);
    }

    [Fact]
    public void Compute_JugRowCarriesItsSizeInTheName_StillMatches()
    {
        var row = Row(name: "Svijanský Kvasničák 13% – 2L", container: ProductContainer.Jug,
            volume: 2, saleUnit: ProductSaleUnit.Single, units: 1);
        var stored = Stored(name: "Svijanský Kvasničák", container: ProductContainer.Jug,
            volume: 2, saleUnit: ProductSaleUnit.Single, units: 1);

        var diff = PriceListDiff.Compute([row], [stored]);

        diff.Should().ContainSingle().Which.Kind.Should().Be(PriceListChangeKind.Unchanged);
    }

    [Fact]
    public void Compute_WhitespaceAndCaseDifferences_DoNotSplitAProduct()
    {
        var diff = PriceListDiff.Compute(
            [Row(name: "  svijanská   DESÍTKA  ")], [Stored(name: "Svijanská Desítka")]);

        diff.Should().ContainSingle().Which.Kind.Should().Be(PriceListChangeKind.Unchanged);
    }

    [Fact]
    public void Compute_ANameThatMerelyEndsInDigits_KeepsThem()
    {
        // "Svijany 450" and "Svijany 20 - výroční pivo" are names, not sizes or degrees.
        var diff = PriceListDiff.Compute(
            [Row(name: "Svijany 450"), Row(name: "Svijany 20 - výroční pivo", volume: 1,
                container: ProductContainer.Jug, saleUnit: ProductSaleUnit.Single, units: 1)],
            [Stored(name: "Svijany 450"), Stored(name: "Svijany 20 - výroční pivo", volume: 1,
                container: ProductContainer.Jug, saleUnit: ProductSaleUnit.Single, units: 1)]);

        diff.Should().OnlyContain(e => e.Kind == PriceListChangeKind.Unchanged);
    }

    [Fact]
    public void Compute_SameBeerInDifferentPackaging_AreSeparateProducts()
    {
        var keg = Row(container: ProductContainer.Keg, volume: 50,
            saleUnit: ProductSaleUnit.Single, units: 1, packWithVat: 1860.00m);

        var diff = PriceListDiff.Compute([Row(), keg], [Stored()]);

        diff.Should().HaveCount(2);
        diff.Should().Contain(e => e.Kind == PriceListChangeKind.Unchanged);
        diff.Should().Contain(e => e.Kind == PriceListChangeKind.Added);
    }

    [Fact]
    public void Compute_CatalogueAlreadyHoldsTheSameProductTwice_MatchesOneAndOffersTheOther()
    {
        // A duplicate must not fail the import: the list names the product once, so one copy
        // matches and the spare is proposed for removal.
        var diff = PriceListDiff.Compute([Row()], [Stored(), Stored()]);

        diff.Should().HaveCount(2);
        diff.Should().ContainSingle(e => e.Kind == PriceListChangeKind.Unchanged);
        diff.Should().ContainSingle(e => e.Kind == PriceListChangeKind.ToRemove);
    }

    [Fact]
    public void Compute_EveryProductLandsInExactlyOneBucket()
    {
        var unchanged = Stored();
        var repriced = Stored(name: "Svijanský Máz");
        var dropped = Stored(name: "Zámek");
        var blocked = Stored(name: "Šlik", isInUse: true);

        var diff = PriceListDiff.Compute(
            [Row(), Row(name: "Svijanský Máz", packWithVat: 360.00m), Row(name: "Bidlovka")],
            [unchanged, repriced, dropped, blocked]);

        diff.Should().HaveCount(5);
        diff.Select(e => e.Name).Should().OnlyHaveUniqueItems();
        diff.Count(e => e.Kind == PriceListChangeKind.Unchanged).Should().Be(1);
        diff.Count(e => e.Kind == PriceListChangeKind.Repriced).Should().Be(1);
        diff.Count(e => e.Kind == PriceListChangeKind.Added).Should().Be(1);
        diff.Count(e => e.Kind == PriceListChangeKind.ToRemove).Should().Be(1);
        diff.Count(e => e.Kind == PriceListChangeKind.Blocked).Should().Be(1);
    }
}
