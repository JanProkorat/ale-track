using AleTrack.Common.Enums;
using AleTrack.Features.Products.Import;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// The seam between a brewery's printed price list and the catalogue. Both the committed seed files
/// and an uploaded list come through here, so a misread column is a wrong price everywhere at once.
/// </summary>
public sealed class PriceListCatalogParserTests
{
    private const string Header =
        "name,type,alcohol,plato,container,volume_l,sale_unit,units,unit_novat,unit_vat,pack_novat,pack_vat";

    private static string File(params string[] rows) => string.Join("\n", [Header, .. rows]);

    [Fact]
    public void Parse_ReadsMetadataAndAFullyPricedRow()
    {
        var content = string.Join("\n",
            "# brewery: Svijany",
            "# effective_from: 2026-05-01",
            "# source: pivovarsvijany.cz/file/2336",
            Header,
            "Svijanská Desítka,PaleDraftBeer,4.0,10,Keg,50,Single,1,15.37,18.60,1537.19,1860.00");

        var result = PriceListCatalogParser.Parse(content);

        result.Succeeded.Should().BeTrue(because: string.Join("; ", result.Errors.Select(e => e.Message)));
        result.Catalog!.Brewery.Should().Be("Svijany");
        result.Catalog.EffectiveFrom.Should().Be(new DateOnly(2026, 5, 1));
        result.Catalog.Source.Should().Be("pivovarsvijany.cz/file/2336");

        var row = result.Catalog.Rows.Should().ContainSingle().Subject;
        row.Name.Should().Be("Svijanská Desítka");
        row.Type.Should().Be(ProductType.PaleDraftBeer);
        row.AlcoholPercentage.Should().BeApproximately(4.0f, 0.001f);
        row.PlatoDegree.Should().BeApproximately(10f, 0.001f);
        row.Container.Should().Be(ProductContainer.Keg);
        row.VolumeLiters.Should().Be(50);
        row.SaleUnit.Should().Be(ProductSaleUnit.Single);
        row.UnitsPerPackage.Should().Be(1);
        row.UnitPriceWithoutVat.Should().Be(15.37m);
        row.UnitPriceWithVat.Should().Be(18.60m);
        row.PackPriceWithoutVat.Should().Be(1537.19m);
        row.PackPriceWithVat.Should().Be(1860.00m);
        row.Derived.Should().Be(PriceDerivation.None);
    }

    [Fact]
    public void Parse_KeepsPrintedPricesEvenWhenTheyDisagreeWithArithmetic()
    {
        // 20 × 13.14 is 262.80, but the list prints 318.00 for the crate because the two figures are
        // rounded independently. The printed number wins; inventing one would misstate the price.
        var result = PriceListCatalogParser.Parse(File(
            "Desítka,PaleDraftBeer,4.0,10,Bottle,0.5,Crate,20,13.14,15.90,,318.00"));

        var row = result.Catalog!.Rows.Single();
        row.UnitPriceWithVat.Should().Be(15.90m);
        row.PackPriceWithVat.Should().Be(318.00m);
    }

    [Fact]
    public void Parse_DerivesTheUnitPriceFromThePackPrice()
    {
        var result = PriceListCatalogParser.Parse(File(
            "Máz 2L,PaleLager,4.8,11,Can,2,Single,1,,,119.83,145.00"));

        var row = result.Catalog!.Rows.Single();
        row.UnitPriceWithVat.Should().Be(145.00m);
        row.UnitPriceWithoutVat.Should().Be(119.83m);
        row.Derived.Should().HaveFlag(PriceDerivation.UnitPrice);
    }

    [Fact]
    public void Parse_DerivesThePackPriceFromTheUnitPrice()
    {
        var result = PriceListCatalogParser.Parse(File(
            "Tray,PaleDraftBeer,4.0,10,Can,0.5,Tray,24,17.27,20.90,,501.60"));

        var row = result.Catalog!.Rows.Single();
        row.PackPriceWithoutVat.Should().Be(24 * 17.27m);
        row.Derived.Should().HaveFlag(PriceDerivation.PackPrice);
    }

    [Fact]
    public void Parse_DerivesWithoutVatOnlyWhenNeitherFigureIsPrinted()
    {
        var result = PriceListCatalogParser.Parse(File(
            "Džbán,PaleStrong,6.0,13,Jug,2,Single,1,,,,490.00"));

        var row = result.Catalog!.Rows.Single();
        // 490 / 1.21 = 404.9586..., rounded away from zero at two places.
        row.PackPriceWithoutVat.Should().Be(404.96m);
        row.Derived.Should().HaveFlag(PriceDerivation.WithoutVat);
    }

    [Fact]
    public void Parse_IgnoresBlankLinesAndPlainComments()
    {
        var result = PriceListCatalogParser.Parse(string.Join("\n",
            "# brewery: Rohozec",
            "# just a note, not metadata",
            "",
            Header,
            "",
            "Skalák,PaleLager,4.8,12,Keg,50,Single,1,,,1537.19,1860.00",
            ""));

        result.Succeeded.Should().BeTrue();
        result.Catalog!.Rows.Should().HaveCount(1);
    }

    [Fact]
    public void Parse_RejectsAFileWhoseHeaderIsMissingAColumn()
    {
        var result = PriceListCatalogParser.Parse(string.Join("\n",
            "name,type,container,volume_l,sale_unit,units,pack_vat",
            "Skalák,PaleLager,Keg,50,Single,1,1860.00"));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Code == PriceListErrorCodes.MissingColumn);
    }

    [Fact]
    public void Parse_RejectsAFileWithNoHeaderAtAll()
    {
        var result = PriceListCatalogParser.Parse("# brewery: Svijany\n");

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Code == PriceListErrorCodes.MissingHeader);
    }

    [Fact]
    public void Parse_RejectsARowWithoutThePackPrice()
    {
        // The one price every section of every list prints. Without it there is nothing to anchor
        // the derivations to.
        var result = PriceListCatalogParser.Parse(File(
            "Skalák,PaleLager,4.8,12,Keg,50,Single,1,,,,"));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.Code == PriceListErrorCodes.MissingValue && e.Line == 2);
    }

    [Fact]
    public void Parse_RejectsAMalformedNumber()
    {
        var result = PriceListCatalogParser.Parse(File(
            "Skalák,PaleLager,4.8,12,Keg,50,Single,1,,,,1 860,00"));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Code == PriceListErrorCodes.InvalidNumber);
    }

    [Fact]
    public void Parse_RejectsAnUnknownContainerOrSaleUnit()
    {
        var result = PriceListCatalogParser.Parse(File(
            "Skalák,PaleLager,4.8,12,Barrel,50,Single,1,,,,1860.00"));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Code == PriceListErrorCodes.InvalidEnum);
    }

    [Fact]
    public void Parse_RejectsTwoRowsDescribingTheSameSellableProduct()
    {
        // Same natural key twice means one of them would silently win the diff against the database.
        var result = PriceListCatalogParser.Parse(File(
            "Skalák,PaleLager,4.8,12,Keg,50,Single,1,,,,1860.00",
            "Skalák,PaleLager,4.8,12,Keg,50,Single,1,,,,1900.00"));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Code == PriceListErrorCodes.DuplicateRow);
    }

    [Fact]
    public void Parse_AllowsTheSameNameInDifferentPackaging()
    {
        // Every brewery sells the same beer as a keg and as a crate; that is not a duplicate.
        var result = PriceListCatalogParser.Parse(File(
            "Skalák,PaleLager,4.8,12,Keg,50,Single,1,,,,1860.00",
            "Skalák,PaleLager,4.8,12,Bottle,0.5,Crate,20,,,,360.00"));

        result.Succeeded.Should().BeTrue(because: string.Join("; ", result.Errors.Select(e => e.Message)));
        result.Catalog!.Rows.Should().HaveCount(2);
    }

    [Fact]
    public void Parse_RejectsAnInvalidEffectiveFrom()
    {
        var result = PriceListCatalogParser.Parse(string.Join("\n",
            "# effective_from: 1. 5. 2026",
            Header,
            "Skalák,PaleLager,4.8,12,Keg,50,Single,1,,,,1860.00"));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Code == PriceListErrorCodes.InvalidDate);
    }

    [Fact]
    public void Parse_RejectsAFileWithNoRows()
    {
        var result = PriceListCatalogParser.Parse(Header);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Code == PriceListErrorCodes.NoRows);
    }

    [Fact]
    public void Parse_CarriesThePublicIdWhenTheFileStatesOne()
    {
        // Rohozec's seeded products have fixed ids on purpose. Reading them from a file without
        // carrying the column would mint fresh GUIDs on every seed and silently discard that.
        var result = PriceListCatalogParser.Parse(string.Join("\n",
            "public_id," + Header,
            "a0000000-0000-0000-0000-000000000007,Roh. Skalák,PaleLager,4.8,11,Keg,50,Single,1,,,1537.19,1860.00"));

        result.Succeeded.Should().BeTrue(because: string.Join("; ", result.Errors.Select(e => e.Message)));
        result.Catalog!.Rows.Single().PublicId
            .Should().Be(Guid.Parse("a0000000-0000-0000-0000-000000000007"));
    }

    [Fact]
    public void Parse_LeavesThePublicIdUnsetWhenTheCellIsBlank()
    {
        // Null is "mint one on the way in", which is what every Svijany row wants.
        var result = PriceListCatalogParser.Parse(string.Join("\n",
            "public_id," + Header,
            ",Svijanská Desítka,PaleDraftBeer,4.0,10,Keg,50,Single,1,,,1537.19,1860.00"));

        result.Succeeded.Should().BeTrue(because: string.Join("; ", result.Errors.Select(e => e.Message)));
        result.Catalog!.Rows.Single().PublicId.Should().BeNull();
    }

    [Fact]
    public void Parse_AcceptsAFileWithoutThePublicIdColumnAtAll()
    {
        var result = PriceListCatalogParser.Parse(File(
            "Skalák,PaleLager,4.8,12,Keg,50,Single,1,,,,1860.00"));

        result.Succeeded.Should().BeTrue(because: string.Join("; ", result.Errors.Select(e => e.Message)));
        result.Catalog!.Rows.Single().PublicId.Should().BeNull();
    }

    [Fact]
    public void Parse_RejectsAMalformedPublicId()
    {
        // Falling back to a generated id would quietly detach the row from the product it names.
        var result = PriceListCatalogParser.Parse(string.Join("\n",
            "public_id," + Header,
            "not-a-guid,Skalák,PaleLager,4.8,12,Keg,50,Single,1,,,,1860.00"));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Code == PriceListErrorCodes.InvalidId && e.Line == 2);
    }

    [Fact]
    public void Parse_RejectsANameLongerThanTheCatalogueCanStore()
    {
        // Caught here rather than at the database, where it would surface as a 500 partway through
        // an import the preview had already reported as applicable.
        var result = PriceListCatalogParser.Parse(File(
            $"{new string('x', 51)},PaleLager,4.8,12,Keg,50,Single,1,,,,1860.00"));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Code == PriceListErrorCodes.NameTooLong);
    }

    [Fact]
    public void Parse_ReportsEveryBadRowRatherThanStoppingAtTheFirst()
    {
        // An import preview is worth much less if it surfaces one problem per attempt.
        var result = PriceListCatalogParser.Parse(File(
            "A,PaleLager,4.8,12,Barrel,50,Single,1,,,,1860.00",
            "B,PaleLager,4.8,12,Keg,50,Single,1,,,,",
            "C,NotAStyle,4.8,12,Keg,50,Single,1,,,,1860.00"));

        result.Errors.Select(e => e.Line).Distinct().Should().HaveCount(3);
    }
}
