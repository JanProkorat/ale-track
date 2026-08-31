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
    public void Compute_StoredPackagingWrong_CorrectsTheProductRatherThanDuplicatingIt()
    {
        // The prod case: a legacy Svijanský Máz recorded as a single 0,5 l can, which the list
        // sells as a 24-can tray. The strict key can never match those two, and every import used
        // to file the tray as new and leave the wrong copy behind.
        var legacy = Stored(
            name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
            saleUnit: ProductSaleUnit.Single, units: 1, priceWithVat: 525.60m);

        var diff = PriceListDiff.Compute(
            [Row(name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
                 saleUnit: ProductSaleUnit.Tray, units: 24, packWithVat: 525.60m)],
            [legacy]);

        var entry = diff.Should().ContainSingle().Subject;
        entry.Kind.Should().Be(PriceListChangeKind.Changed);
        entry.Existing!.PublicId.Should().Be(legacy.PublicId);

        // The packaging correction is what the entry is for, so it has to be visible in the preview.
        entry.Changes.Should().Contain(c => c.Field == "SaleUnit" && c.Before == "Single" && c.After == "Tray");
        entry.Changes.Should().Contain(c => c.Field == "UnitsPerPackage" && c.Before == "1" && c.After == "24");
    }

    [Fact]
    public void Compute_TwoRowsCompetingForOneStoredProduct_GuessesNeither()
    {
        // A list selling both a 12-can and a 24-can tray, against a single legacy row: there is no
        // non-arbitrary way to say which tray that row is, so the old behaviour stands and a person
        // decides.
        var legacy = Stored(
            name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
            saleUnit: ProductSaleUnit.Single, units: 1);

        var diff = PriceListDiff.Compute(
            [Row(name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
                 saleUnit: ProductSaleUnit.Tray, units: 12),
             Row(name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
                 saleUnit: ProductSaleUnit.Tray, units: 24)],
            [legacy]);

        diff.Count(e => e.Kind == PriceListChangeKind.Added).Should().Be(2);
        diff.Should().ContainSingle(e => e.Kind == PriceListChangeKind.ToRemove);
    }

    [Fact]
    public void Compute_TwoStoredCandidatesForOneRow_GuessesNeither()
    {
        // Mirror of the above: which of two stored copies the row restates is equally unanswerable.
        var diff = PriceListDiff.Compute(
            [Row(name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
                 saleUnit: ProductSaleUnit.Tray, units: 24)],
            [Stored(name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
                    saleUnit: ProductSaleUnit.Single, units: 1),
             Stored(name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
                    saleUnit: ProductSaleUnit.Multipack, units: 6)]);

        diff.Should().ContainSingle(e => e.Kind == PriceListChangeKind.Added);
        diff.Count(e => e.Kind == PriceListChangeKind.ToRemove).Should().Be(2);
    }

    /// <summary>
    /// The loose pass must not steal a product another row matches exactly — the strict pass claims
    /// every product it can before a single fallback is considered.
    /// </summary>
    [Fact]
    public void Compute_LooseMatchNeverStealsAStrictlyMatchedProduct()
    {
        var tray24 = Stored(
            name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
            saleUnit: ProductSaleUnit.Tray, units: 24);

        // The 24 row matches tray24 exactly; the 12 row has nothing left to fall back to.
        var diff = PriceListDiff.Compute(
            [Row(name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
                 saleUnit: ProductSaleUnit.Tray, units: 12),
             Row(name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
                 saleUnit: ProductSaleUnit.Tray, units: 24)],
            [tray24]);

        diff.Should().HaveCount(2);
        diff.Should().ContainSingle(e =>
            e.Kind == PriceListChangeKind.Unchanged && e.Existing!.PublicId == tray24.PublicId);
        diff.Should().ContainSingle(e => e.Kind == PriceListChangeKind.Added);
    }

    /// <summary>
    /// A stored duplicate is a home for a row the strict key missed: repurposing the spare copy
    /// beats inserting a third one and proposing the spare for removal.
    /// </summary>
    [Fact]
    public void Compute_StoredDuplicate_AbsorbsARowTheStrictKeyMissed()
    {
        var diff = PriceListDiff.Compute(
            [Row(name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
                 saleUnit: ProductSaleUnit.Tray, units: 24),
             Row(name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
                 saleUnit: ProductSaleUnit.Tray, units: 12)],
            [Stored(name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
                    saleUnit: ProductSaleUnit.Tray, units: 24),
             Stored(name: "Svijanský Máz", container: ProductContainer.Can, volume: 0.5,
                    saleUnit: ProductSaleUnit.Tray, units: 24)]);

        diff.Should().HaveCount(2);
        diff.Should().NotContain(e => e.Kind == PriceListChangeKind.Added);
        diff.Should().NotContain(e => e.Kind == PriceListChangeKind.ToRemove);
        diff.Should().ContainSingle(e => e.Kind == PriceListChangeKind.Changed);
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
