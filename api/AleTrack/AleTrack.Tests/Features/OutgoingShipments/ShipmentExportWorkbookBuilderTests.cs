using AleTrack.Common.Enums;
using AleTrack.Features.OutgoingShipments.Queries.Export;
using ClosedXML.Excel;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// What the shipment export workbook actually contains: sheet names Excel will accept, the run's
/// overview, and one product table per client.
/// </summary>
public sealed class ShipmentExportWorkbookBuilderTests
{
    private static ShipmentExportStop BuildStop(
        int order,
        string clientName,
        string? street = "Dlouhá 14",
        string? cityLine = "602 00 Brno",
        string? city = "Brno",
        string? deliveryPlaceName = null,
        List<string>? notes = null,
        List<ShipmentExportProduct>? products = null,
        List<ShipmentExportReturn>? returns = null) =>
        new()
        {
            Order = order,
            ClientName = clientName,
            Street = street,
            CityLine = cityLine,
            City = city,
            DeliveryPlaceName = deliveryPlaceName,
            Notes = notes ?? [],
            Products = products ?? [BuildProduct("Pilsner Urquell", 24)],
            Returns = returns ?? []
        };

    private static ShipmentExportProduct BuildProduct(
        string name,
        int quantity,
        ProductKind? kind = ProductKind.Bottle,
        double? packageSize = 0.5) =>
        new() { Name = name, Quantity = quantity, Kind = kind, PackageSize = packageSize };

    private static ShipmentExportModel BuildModel(
        string name = "Pátek – Brno",
        DateTime? deliveryDate = null,
        string? vehicleName = "Iveco Daily",
        List<string>? driverNames = null,
        List<ShipmentExportStop>? stops = null,
        List<ShipmentExportProduct>? stockPurchases = null) =>
        new()
        {
            ShipmentName = name,
            DeliveryDate = deliveryDate ?? new DateTime(2026, 8, 3, 0, 0, 0, DateTimeKind.Utc),
            VehicleName = vehicleName,
            DriverNames = driverNames ?? ["Jan Novák"],
            Stops = stops ?? [BuildStop(1, "Hospoda U Kotvy")],
            StockPurchases = stockPurchases ?? []
        };

    private static XLWorkbook Open(ShipmentExportModel model) =>
        new(new MemoryStream(ShipmentExportWorkbookBuilder.Build(model)));

    /// <summary>
    /// Finds the row a label sits on, so a test does not break when a block above it grows a line.
    /// </summary>
    private static int RowOf(IXLWorksheet sheet, string label)
    {
        var cell = sheet.Column(1).CellsUsed(c => c.GetString() == label).FirstOrDefault();
        cell.Should().NotBeNull($"the sheet should carry a \"{label}\" row");
        return cell!.Address.RowNumber;
    }

    [Fact]
    public void Build_ClientStops_ProducesAnOverviewSheetPlusOneSheetPerClientStop()
    {
        var model = BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy"),
            new ShipmentExportStop { Order = 2, Label = "Čerpací stanice" },
            BuildStop(3, "Pivnice Na Růhu")
        ]);

        using var workbook = Open(model);

        // The custom stop gets no sheet — it has no client and no goods.
        workbook.Worksheets.Select(s => s.Name).Should().Equal(
            "Přehled",
            "1. Hospoda U Kotvy",
            "3. Pivnice Na Růhu");
    }

    [Fact]
    public void Build_OverviewSheet_SummarisesTheRun()
    {
        var model = BuildModel(
            driverNames: ["Petr Adamec", "Jan Novák"],
            stops:
            [
                BuildStop(1, "Hospoda U Kotvy", products: [BuildProduct("Pilsner Urquell", 24)]),
                new ShipmentExportStop { Order = 2, Label = "Čerpací stanice" },
                BuildStop(3, "Pivnice Na Růhu", city: "Olomouc", products: [BuildProduct("Kozel 11", 6)])
            ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Přehled");

        sheet.Cell(RowOf(sheet, "Vývoz"), 2).GetString().Should().Be("Pátek – Brno");
        sheet.Cell(RowOf(sheet, "Vozidlo"), 2).GetString().Should().Be("Iveco Daily");
        sheet.Cell(RowOf(sheet, "Řidiči"), 2).GetString().Should().Be("Petr Adamec, Jan Novák");

        // A real date cell rather than text, so the reader can sort a folder of these.
        var dateCell = sheet.Cell(RowOf(sheet, "Datum dodání"), 2);
        dateCell.GetDateTime().Should().Be(new DateTime(2026, 8, 3, 0, 0, 0, DateTimeKind.Unspecified));

        sheet.Cell(RowOf(sheet, "Zastávek"), 2).GetValue<int>().Should().Be(3);
        sheet.Cell(RowOf(sheet, "Klientů"), 2).GetValue<int>().Should().Be(2, "the custom stop has no client");
        sheet.Cell(RowOf(sheet, "Celkem kusů"), 2).GetValue<int>().Should().Be(30);

        // Every stop is listed, custom ones by their label — this table is the only place they show.
        var tableHeaderRow = RowOf(sheet, "ZASTÁVKA");
        sheet.Cell(tableHeaderRow + 1, 2).GetString().Should().Be("Hospoda U Kotvy");
        sheet.Cell(tableHeaderRow + 1, 4).GetValue<int>().Should().Be(24);
        sheet.Cell(tableHeaderRow + 2, 2).GetString().Should().Be("Čerpací stanice");
        sheet.Cell(tableHeaderRow + 2, 4).GetString().Should().Be("—", "a custom stop delivers nothing");
        sheet.Cell(tableHeaderRow + 3, 3).GetString().Should().Be("Olomouc");
    }

    // The run's internal number means nothing to whoever reads this file, and the date plus the name
    // already identify which run it is.
    [Fact]
    public void Build_OverviewSheet_DoesNotCarryTheRunsInternalNumber()
    {
        using var workbook = Open(BuildModel());
        var sheet = workbook.Worksheet("Přehled");

        sheet.Column(1).CellsUsed(c => c.GetString() == "Číslo").Should().BeEmpty();
        sheet.CellsUsed(c => c.GetString().StartsWith('#')).Should().BeEmpty();
    }

    [Fact]
    public void Build_StopSheet_WritesTheClientAddressItsProductsAndATotal()
    {
        var model = BuildModel(stops:
        [
            BuildStop(
                1,
                "Hospoda U Kotvy",
                deliveryPlaceName: "Zahrádka",
                notes: ["Volat 30 min předem", "Brána z boku"],
                products:
                [
                    BuildProduct("Pilsner Urquell", 24),
                    BuildProduct("Kozel 11", 6, ProductKind.Keg, 30),
                    // A custom extra: ordered all the same, but with no product behind it.
                    BuildProduct("Slunečník", 2, kind: null, packageSize: null)
                ])
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("1. Hospoda U Kotvy");

        sheet.Cell(RowOf(sheet, "Klient"), 2).GetString().Should().Be("Hospoda U Kotvy");
        sheet.Cell(RowOf(sheet, "Ulice"), 2).GetString().Should().Be("Dlouhá 14");
        sheet.Cell(RowOf(sheet, "PSČ a město"), 2).GetString().Should().Be("602 00 Brno");
        sheet.Cell(RowOf(sheet, "Místo dodání"), 2).GetString().Should().Be("Zahrádka");

        // The second note continues under the first with no repeated label.
        var notesRow = RowOf(sheet, "Poznámky");
        sheet.Cell(notesRow, 2).GetString().Should().Be("Volat 30 min předem");
        sheet.Cell(notesRow + 1, 1).GetString().Should().BeEmpty();
        sheet.Cell(notesRow + 1, 2).GetString().Should().Be("Brána z boku");

        var headerRow = RowOf(sheet, "PRODUKT");
        sheet.Cell(headerRow, 2).GetString().Should().Be("DRUH");
        sheet.Cell(headerRow, 3).GetString().Should().Be("BALENÍ (L)");
        sheet.Cell(headerRow, 4).GetString().Should().Be("MNOŽSTVÍ (KS)");

        sheet.Cell(headerRow + 1, 1).GetString().Should().Be("Pilsner Urquell");
        sheet.Cell(headerRow + 1, 2).GetString().Should().Be("Basa");
        sheet.Cell(headerRow + 1, 3).GetValue<double>().Should().Be(0.5);
        sheet.Cell(headerRow + 1, 4).GetValue<int>().Should().Be(24);

        sheet.Cell(headerRow + 2, 2).GetString().Should().Be("Sud");
        sheet.Cell(headerRow + 2, 3).GetValue<double>().Should().Be(30);

        sheet.Cell(headerRow + 3, 1).GetString().Should().Be("Slunečník");
        sheet.Cell(headerRow + 3, 2).GetString().Should().Be("—");
        sheet.Cell(headerRow + 3, 3).GetString().Should().Be("—");

        var totalRow = RowOf(sheet, "Celkem");
        sheet.Cell(totalRow, 4).GetValue<int>().Should().Be(32);

        // Quantities are numbers, not text, so the office can sum a column in Excel itself.
        sheet.Cell(headerRow + 1, 4).DataType.Should().Be(XLDataType.Number);
    }

    [Fact]
    public void Build_StopWithReturns_WritesThemBelowTheProducts()
    {
        var model = BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy", returns:
            [
                new ShipmentExportReturn { Name = "Sud 30l KEG", Quantity = 6, Note = "poškozený ventil" }
            ])
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("1. Hospoda U Kotvy");

        var headingRow = RowOf(sheet, "VRACÍ");
        RowOf(sheet, "Celkem").Should().BeLessThan(headingRow, "what goes back reads after what is delivered");

        // Contiguous columns. The quantity deliberately does not line up with the products table's:
        // these pieces travel the other way and must never be summed into the delivered total.
        sheet.Cell(headingRow + 1, 1).GetString().Should().Be("POLOŽKA");
        sheet.Cell(headingRow + 1, 2).GetString().Should().Be("POZNÁMKA");
        sheet.Cell(headingRow + 1, 3).GetString().Should().Be("MNOŽSTVÍ (KS)");

        sheet.Cell(headingRow + 2, 1).GetString().Should().Be("Sud 30l KEG");
        sheet.Cell(headingRow + 2, 2).GetString().Should().Be("poškozený ventil");
        sheet.Cell(headingRow + 2, 3).GetValue<int>().Should().Be(6);
    }

    // Most vratky carry no note, and an always-present empty column reads as information that failed
    // to load rather than information that does not exist.
    [Fact]
    public void Build_ReturnsWithNoNotes_DropTheNoteColumnEntirely()
    {
        var model = BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy", returns:
            [
                new ShipmentExportReturn { Name = "Basa", Quantity = 25 },
                new ShipmentExportReturn { Name = "Velký sud", Quantity = 3 }
            ])
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("1. Hospoda U Kotvy");

        var headingRow = RowOf(sheet, "VRACÍ");

        sheet.Cell(headingRow + 1, 1).GetString().Should().Be("POLOŽKA");
        sheet.Cell(headingRow + 1, 2).GetString().Should().Be("MNOŽSTVÍ (KS)");
        sheet.Cell(headingRow + 1, 3).GetString().Should().BeEmpty("there is no third column to head");

        sheet.Cell(headingRow + 2, 1).GetString().Should().Be("Basa");
        sheet.Cell(headingRow + 2, 2).GetValue<int>().Should().Be(25);
        sheet.Cell(headingRow + 3, 2).GetValue<int>().Should().Be(3);
    }

    /// <summary>
    /// Every column of a heading band is shaded. An earlier layout skipped one so the returns table
    /// could line its quantity up with the products table's, which left an unshaded hole mid-band.
    /// </summary>
    [Fact]
    public void Build_HeadingBands_AreShadedWithNoGaps()
    {
        var model = BuildModel(
            stops:
            [
                BuildStop(1, "Hospoda U Kotvy", returns:
                [
                    new ShipmentExportReturn { Name = "Sud 30l KEG", Quantity = 6, Note = "prasklý" }
                ])
            ],
            stockPurchases: [BuildProduct("Radegast", 3, ProductKind.Keg, 50)]);

        using var workbook = Open(model);

        // The exact fill, not merely "not NoColor": an untouched ClosedXML cell does not report
        // NoColor, so a not-equal assertion here would pass for every cell in the sheet and prove
        // nothing at all.
        var expected = XLColor.FromArgb(0xF2, 0xF2, 0xF2);

        var overview = workbook.Worksheet("Přehled");
        var stopSheet = workbook.Worksheet("1. Hospoda U Kotvy");

        foreach (var (sheet, headerRow, columns) in new[]
                 {
                     (overview, RowOf(overview, "ZASTÁVKA"), 4),
                     (overview, RowOf(overview, "PRODUKT"), 4),
                     (stopSheet, RowOf(stopSheet, "PRODUKT"), 4),
                     (stopSheet, RowOf(stopSheet, "POLOŽKA"), 3)
                 })
        {
            for (var column = 1; column <= columns; column++)
            {
                var cell = sheet.Cell(headerRow, column);
                cell.Style.Fill.BackgroundColor.Should().Be(expected, $"{sheet.Name}!{cell.Address}");
                cell.GetString().Should().NotBeEmpty($"{sheet.Name}!{cell.Address}");
            }
        }

        // Proof the assertion above can fail: the rows under a band are not shaded.
        stopSheet.Cell(RowOf(stopSheet, "PRODUKT") + 1, 1).Style.Fill.BackgroundColor
            .Should().NotBe(expected, "only the heading band is shaded");
    }

    /// <summary>
    /// Numbers stay numbers and carry a format, so Excel groups thousands using the reader's own
    /// separators and the office can still sum the column.
    /// </summary>
    [Fact]
    public void Build_Numbers_AreRealNumbersCarryingAFormat()
    {
        var model = BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy", products:
            [
                new ShipmentExportProduct
                {
                    Name = "Pilsner Urquell", Kind = ProductKind.Bottle,
                    PackageSize = 0.5, Weight = 15.7, Quantity = 1200
                }
            ])
        ]);

        using var workbook = Open(model);

        var overview = workbook.Worksheet("Přehled");
        var weight = overview.Cell(RowOf(overview, "Hmotnost (kg)"), 2);
        weight.DataType.Should().Be(XLDataType.Number);
        weight.Style.NumberFormat.Format.Should().Be("#,##0.0");
        weight.GetValue<double>().Should().BeApproximately(18840, 0.01);

        var sheet = workbook.Worksheet("1. Hospoda U Kotvy");
        var headerRow = RowOf(sheet, "PRODUKT");

        // Package size carries no explicit format on purpose: it renders as 0,5 and 30 on General,
        // while every decimal format either pads a whole size with zeros or leaves "30," behind.
        var size = sheet.Cell(headerRow + 1, 3);
        size.DataType.Should().Be(XLDataType.Number);
        size.GetFormattedString().Should().Be("0,5");

        var quantity = sheet.Cell(headerRow + 1, 4);
        quantity.DataType.Should().Be(XLDataType.Number);
        quantity.Style.NumberFormat.Format.Should().Be("#,##0");
    }

    /// <summary>
    /// Column 1 of the overview also holds the stock block's product names, the longest text on that
    /// sheet — at 22 wide "Svijanský Vozka yuzu &amp; bergamot" was cut off mid-word.
    /// </summary>
    [Fact]
    public void Build_OverviewFirstColumn_IsWideEnoughForAProductName()
    {
        var model = BuildModel(stockPurchases:
        [
            BuildProduct("Svijanský Vozka yuzu & bergamot", 1, ProductKind.Can, 0.5)
        ]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("Přehled");

        sheet.Column(1).Width.Should().BeGreaterThanOrEqualTo("Svijanský Vozka yuzu & bergamot".Length);
    }

    // A label answered by a number sat a stride away from it when Excel right-aligned the value.
    [Fact]
    public void Build_LabelBlockValues_SitNextToTheirLabel()
    {
        using var workbook = Open(BuildModel());
        var sheet = workbook.Worksheet("Přehled");

        foreach (var label in new[] { "Datum dodání", "Zastávek", "Klientů", "Celkem kusů", "Hmotnost (kg)" })
        {
            sheet.Cell(RowOf(sheet, label), 2).Style.Alignment.Horizontal
                .Should().Be(XLAlignmentHorizontalValues.Left, label);
        }
    }

    // One driver is not a list of one.
    [Theory]
    [InlineData("Řidič", "Jan Novák")]
    [InlineData("Řidiči", "Jan Novák", "Petr Adamec")]
    public void Build_LabelsTheDriverRowForHowManyDrive(string expected, params string[] drivers)
    {
        using var workbook = Open(BuildModel(driverNames: [.. drivers]));
        var sheet = workbook.Worksheet("Přehled");

        sheet.Column(1).CellsUsed(c => c.GetString() == expected).Should().HaveCount(1);
    }

    [Fact]
    public void Build_StopWithNoReturnsOrNotes_LeavesThoseSectionsOutEntirely()
    {
        using var workbook = Open(BuildModel());
        var sheet = workbook.Worksheet("1. Hospoda U Kotvy");

        // An empty "Poznámky" row reads as "no instructions", which is a claim this sheet cannot
        // make; an empty "Vrací" heading reads the same way about returns.
        sheet.Column(1).CellsUsed(c => c.GetString() == "Poznámky").Should().BeEmpty();
        sheet.Column(1).CellsUsed(c => c.GetString() == "VRACÍ").Should().BeEmpty();
    }

    [Fact]
    public void Build_StockPurchases_GetABlockOnTheOverviewSheetRatherThanASheetOfTheirOwn()
    {
        var model = BuildModel(stockPurchases: [BuildProduct("Radegast", 3, ProductKind.Keg, 50)]);

        using var workbook = Open(model);

        workbook.Worksheets.Select(s => s.Name).Should().Equal("Přehled", "1. Hospoda U Kotvy");

        var sheet = workbook.Worksheet("Přehled");
        var headingRow = RowOf(sheet, "ZBOŽÍ NA SKLAD");

        sheet.Cell(headingRow + 2, 1).GetString().Should().Be("Radegast");
        sheet.Cell(headingRow + 2, 4).GetValue<int>().Should().Be(3);
    }

    [Fact]
    public void Build_NoStockPurchases_OmitsTheBlock()
    {
        using var workbook = Open(BuildModel());

        workbook.Worksheet("Přehled").Column(1)
            .CellsUsed(c => c.GetString() == "ZBOŽÍ NA SKLAD")
            .Should().BeEmpty();
    }

    [Fact]
    public void Build_StopWithNoProducts_SaysSoRatherThanLeavingTheTableBlank()
    {
        var model = BuildModel(stops: [BuildStop(1, "Hospoda U Kotvy", products: [])]);

        using var workbook = Open(model);
        var sheet = workbook.Worksheet("1. Hospoda U Kotvy");

        sheet.Cell(RowOf(sheet, "PRODUKT") + 1, 1).GetString().Should().Be("Bez položek");
    }

    [Fact]
    public void SheetNameFor_NameWithCharactersExcelForbids_StripsThem()
    {
        var name = ShipmentExportWorkbookBuilder.SheetNameFor(
            BuildStop(1, "Hospoda [U Kotvy]: pivo/pivo"),
            new HashSet<string>());

        name.Should().Be("1. Hospoda U Kotvy pivo pivo");
        name.Should().NotContainAny("[", "]", ":", "/", "\\", "*", "?");
    }

    [Fact]
    public void SheetNameFor_NameLongerThanExcelAllows_TruncatesToThirtyOneCharacters()
    {
        var name = ShipmentExportWorkbookBuilder.SheetNameFor(
            BuildStop(12, "Restaurace a penzion U Zeleného stromu"),
            new HashSet<string>());

        name.Should().HaveLength(31);
        name.Should().StartWith("12. Restaurace a penzion");
    }

    [Fact]
    public void SheetNameFor_TwoStopsTruncatingToTheSameName_SuffixesWithoutExceedingTheLimit()
    {
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var longName = "Restaurace a penzion U Zeleného stromu";

        var first = ShipmentExportWorkbookBuilder.SheetNameFor(BuildStop(1, longName), used);
        var second = ShipmentExportWorkbookBuilder.SheetNameFor(BuildStop(1, longName), used);
        var third = ShipmentExportWorkbookBuilder.SheetNameFor(BuildStop(1, longName), used);

        // Excel rejects a duplicate name outright, so the suffix has to displace characters rather
        // than push the name past 31.
        new[] { first, second, third }.Should().OnlyHaveUniqueItems();
        second.Should().EndWith(" (2)").And.HaveLength(31);
        third.Should().EndWith(" (3)").And.HaveLength(31);
    }

    [Fact]
    public void Build_OneClientOnTwoStops_NamesBothSheetsByStopSoNeitherIsLost()
    {
        var model = BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy"),
            BuildStop(4, "Hospoda U Kotvy")
        ]);

        using var workbook = Open(model);

        workbook.Worksheets.Select(s => s.Name).Should().Equal(
            "Přehled",
            "1. Hospoda U Kotvy",
            "4. Hospoda U Kotvy");
    }
}
