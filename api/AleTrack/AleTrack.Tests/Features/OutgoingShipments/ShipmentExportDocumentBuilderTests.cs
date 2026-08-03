using AleTrack.Common.Enums;
using AleTrack.Features.OutgoingShipments.Queries.Export;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Validation;
using DocumentFormat.OpenXml.Wordprocessing;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// What the shipment export document contains: the run's overview, then a page per client.
/// </summary>
/// <remarks>
/// Every test opens the produced bytes with the OpenXML SDK rather than inspecting the builder's
/// intermediate objects, so a document Word would refuse to open fails here too.
/// </remarks>
public sealed class ShipmentExportDocumentBuilderTests
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

    private static Body Open(ShipmentExportModel model)
    {
        var stream = new MemoryStream(ShipmentExportDocumentBuilder.Build(model));
        using var document = WordprocessingDocument.Open(stream, isEditable: false);
        return document.MainDocumentPart!.Document.Body!;
    }

    /// <summary>Every paragraph's text, in document order, blank ones dropped.</summary>
    private static List<string> Paragraphs(Body body) =>
        body.Descendants<Paragraph>()
            .Select(p => p.InnerText)
            .Where(text => text.Length > 0)
            .ToList();

    /// <summary>The nth table of the body.</summary>
    private static Table sheetTable(Body body, int index) =>
        body.Elements<Table>().ElementAt(index);

    /// <summary>Rows of the nth table, each as its cells' text.</summary>
    private static List<List<string>> TableRows(Body body, int index) =>
        body.Elements<Table>()
            .ElementAt(index)
            .Elements<TableRow>()
            .Select(row => row.Elements<TableCell>().Select(c => c.InnerText).ToList())
            .ToList();

    [Fact]
    public void Build_ProducesADocumentTheOpenXmlSdkCanRead()
    {
        var bytes = ShipmentExportDocumentBuilder.Build(BuildModel());

        bytes.Should().NotBeEmpty();

        // "PK" — a .docx is a zip package.
        bytes[0].Should().Be((byte)'P');
        bytes[1].Should().Be((byte)'K');
    }

    /// <summary>
    /// The document is hand-built WordprocessingML, and OOXML element order is strict — properties
    /// must precede content, and a misplaced element makes Word refuse the file with a repair
    /// prompt. Reading the bytes back does not catch that; schema validation does.
    /// </summary>
    [Fact]
    public void Build_ProducesSchemaValidWordprocessingMl()
    {
        // Exercised over a model that reaches every branch: a custom stop, notes, returns, a custom
        // extra with no product behind it, and the stock-purchase block.
        var model = BuildModel(
            stops:
            [
                BuildStop(
                    1,
                    "Hospoda U Kotvy",
                    deliveryPlaceName: "Zahrádka",
                    notes: ["Volat 30 min předem", "Brána z boku"],
                    products:
                    [
                        BuildProduct("Pilsner Urquell", 24),
                        BuildProduct("Slunečník", 2, kind: null, packageSize: null)
                    ],
                    returns: [new ShipmentExportReturn { Name = "Sud 30l KEG", Quantity = 6, Note = "prasklý" }]),
                new ShipmentExportStop { Order = 2, Label = "Čerpací stanice" },
                BuildStop(3, "Bez položek s.r.o.", products: [])
            ],
            stockPurchases: [BuildProduct("Radegast", 3, ProductKind.Keg, 50)]);

        var stream = new MemoryStream(ShipmentExportDocumentBuilder.Build(model));
        using var document = WordprocessingDocument.Open(stream, isEditable: false);

        var errors = new OpenXmlValidator().Validate(document).ToList();

        errors.Should().BeEmpty(
            "Word rejects a schema-invalid document: {0}",
            string.Join("; ", errors.Select(e => $"{e.Path?.XPath}: {e.Description}")));
    }

    /// <summary>
    /// A model reaching every block, for the structural assertions below.
    /// </summary>
    private static ShipmentExportModel BuildFullModel() =>
        BuildModel(
            stops:
            [
                BuildStop(
                    1,
                    "Hospoda U Kotvy",
                    deliveryPlaceName: "Zahrádka",
                    notes: ["Volat 30 min předem"],
                    products: [BuildProduct("Pilsner Urquell", 24)],
                    returns: [new ShipmentExportReturn { Name = "Sud 30l KEG", Quantity = 6 }]),
                new ShipmentExportStop { Order = 2, Label = "Čerpací stanice" },
                BuildStop(3, "Bez položek s.r.o.", products: [])
            ],
            stockPurchases: [BuildProduct("Radegast", 3, ProductKind.Keg, 50)]);

    /// <summary>
    /// Without declared page geometry a reader has no page to lay content out against, and pushes
    /// each fixed-width table onto a sheet of its own — which put one client's heading, address and
    /// goods on three separate pages.
    /// </summary>
    [Fact]
    public void Build_DeclaresA4PageGeometryAsTheLastElementOfTheBody()
    {
        var body = Open(BuildFullModel());

        body.LastChild.Should().BeOfType<SectionProperties>("the schema puts sectPr last");

        var setup = body.Elements<SectionProperties>().Single();

        var size = setup.Elements<PageSize>().Single();
        size.Width!.Value.Should().Be(11906U, "A4 portrait width in twips");
        size.Height!.Value.Should().Be(16838U, "A4 portrait height in twips");

        // 2 cm all round leaves 9638 twips of text width for the 9000-twip tables.
        var margin = setup.Elements<PageMargin>().Single();
        margin.Left!.Value.Should().Be(1134U);
        margin.Right!.Value.Should().Be(1134U);
        (size.Width.Value - margin.Left.Value - margin.Right.Value)
            .Should().BeGreaterThan(9000U, "every table has to fit inside the text width");
    }

    /// <summary>
    /// Word merges two tables that sit directly against each other, which ran a client's address
    /// block into their product table; and a body ending on a table is a shape Word repairs.
    /// </summary>
    [Fact]
    public void Build_NeverPlacesTwoTablesDirectlyAgainstEachOther()
    {
        var body = Open(BuildFullModel());

        var children = body.ChildElements.ToList();
        var adjacent = children
            .Zip(children.Skip(1))
            .Count(pair => pair.First is Table && pair.Second is Table);

        adjacent.Should().Be(0);
        children[^2].Should().NotBeOfType<Table>("a table cannot be the last content before sectPr");
    }

    /// <summary>
    /// One hard break per client and nowhere else, each immediately before that client's heading.
    /// </summary>
    /// <remarks>
    /// Asserted on an explicit <c>w:br w:type="page"</c> run rather than on <c>pageBreakBefore</c>:
    /// the latter is a hint readers outside Word ignore, which is what ran every client onto the
    /// previous client's page.
    /// </remarks>
    [Fact]
    public void Build_StartsEachClientOnAFreshPage()
    {
        var model = BuildFullModel();
        var body = Open(model);

        var children = body.ChildElements.ToList();

        var breakIndices = children
            .Select((child, index) => (child, index))
            .Where(entry => entry.child is Paragraph paragraph
                && paragraph.Descendants<Break>().Any(b => b.Type?.Value == BreakValues.Page))
            .Select(entry => entry.index)
            .ToList();

        breakIndices.Should().HaveCount(
            model.ClientStops.Count(),
            "one break per client — the overview keeps the first page, and a custom stop has no page");

        // Each break is followed directly by the heading of the client it opens, so no content can
        // slip onto the previous client's page.
        breakIndices.Select(index => children[index + 1].InnerText)
            .Should().Equal("1. Hospoda U Kotvy", "3. Bez položek s.r.o.");
    }

    // Both mechanisms together would break twice and leave a blank page between every client.
    [Fact]
    public void Build_DoesNotAlsoUseTheParagraphLevelBreakHint()
    {
        var body = Open(BuildFullModel());

        body.Descendants<PageBreakBefore>().Should().BeEmpty();
    }

    [Fact]
    public void Build_DeclaresDocumentWideDefaultsSoTextHasAKnownFontAndSpacing()
    {
        var stream = new MemoryStream(ShipmentExportDocumentBuilder.Build(BuildModel()));
        using var document = WordprocessingDocument.Open(stream, isEditable: false);

        var defaults = document.MainDocumentPart!.StyleDefinitionsPart!.Styles!.DocDefaults;

        defaults.Should().NotBeNull();
        defaults!.RunPropertiesDefault!.RunPropertiesBaseStyle!.RunFonts!.Ascii!.Value
            .Should().NotBeNullOrEmpty();
        defaults.ParagraphPropertiesDefault!.ParagraphPropertiesBaseStyle!.SpacingBetweenLines
            .Should().NotBeNull();
    }

    [Fact]
    public void Build_Overview_LeadsWithTheRunAndItsSummary()
    {
        var body = Open(BuildModel(driverNames: ["Petr Adamec", "Jan Novák"]));

        Paragraphs(body).First().Should().Be("Pátek – Brno");

        var summary = TableRows(body, 0);
        summary.Should().Contain(row => row[0] == "Datum dodání" && row[1] == "3.8.2026");
        summary.Should().Contain(row => row[0] == "Vozidlo" && row[1] == "Iveco Daily");
        summary.Should().Contain(row => row[0] == "Řidiči" && row[1] == "Petr Adamec, Jan Novák");
        summary.Should().Contain(row => row[0] == "Celkem kusů" && row[1] == "24");
    }

    [Fact]
    public void Build_Overview_ListsEveryStopIncludingCustomOnes()
    {
        var body = Open(BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy"),
            new ShipmentExportStop { Order = 2, Label = "Čerpací stanice" },
            BuildStop(3, "Pivnice Na Růhu", city: "Olomouc", products: [BuildProduct("Kozel 11", 6)])
        ]));

        var stops = TableRows(body, 1);

        // Bare numbers here, unlike the product tables: this column's own header names the unit.
        stops[0].Should().Equal("ZASTÁVKA", "KLIENT", "MĚSTO", "KUSŮ");
        stops[1].Should().Equal("1", "Hospoda U Kotvy", "Brno", "24");
        // A custom stop is on the route but delivers nothing, so a 0 would read as a wasted trip.
        stops[2].Should().Equal("2", "Čerpací stanice", "—", "—");
        stops[3].Should().Equal("3", "Pivnice Na Růhu", "Olomouc", "6");
    }

    [Fact]
    public void Build_EachClient_StartsOnItsOwnPage()
    {
        var body = Open(BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy"),
            BuildStop(2, "Pivnice Na Růhu")
        ]));

        var children = body.ChildElements.ToList();

        // This is handed over per stop, so a page holding the tail of one client and the head of the
        // next cannot serve. Every client is opened by a break, the first one ending the overview.
        var opened = children
            .Select((child, index) => (child, index))
            .Where(entry => entry.child is Paragraph paragraph
                && paragraph.Descendants<Break>().Any(b => b.Type?.Value == BreakValues.Page))
            .Select(entry => children[entry.index + 1].InnerText)
            .ToList();

        opened.Should().Equal("1. Hospoda U Kotvy", "2. Pivnice Na Růhu");
    }

    [Fact]
    public void Build_ClientPage_CarriesTheAddressAndTheProductsWithATotal()
    {
        var body = Open(BuildModel(stops:
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
        ]));

        var details = TableRows(body, 2);
        details.Should().Contain(row => row[0] == "Ulice" && row[1] == "Dlouhá 14");
        details.Should().Contain(row => row[0] == "PSČ a město" && row[1] == "602 00 Brno");
        details.Should().Contain(row => row[0] == "Místo dodání" && row[1] == "Zahrádka");

        // The second note continues under the first with no repeated label.
        details.Should().Contain(row => row[0] == "Poznámky" && row[1] == "Volat 30 min předem");
        details.Should().Contain(row => row[0] == string.Empty && row[1] == "Brána z boku");

        var products = TableRows(body, 3);
        products[0].Should().Equal("PRODUKT", "DRUH", "BALENÍ", "MNOŽSTVÍ");
        products[1].Should().Equal("Pilsner Urquell", "Basa", "0,5 l", "24 ks");
        products[2].Should().Equal("Kozel 11", "Sud", "30 l", "6 ks");
        products[3].Should().Equal("Slunečník", "—", "—", "2 ks");

        // Three cells, not four: the two columns with no total to show are merged rather than left as
        // empty bordered boxes, which read as values that failed to arrive.
        products[4].Should().Equal("Celkem", string.Empty, "32 ks");
        sheetTable(body, 3).Elements<TableRow>().Last()
            .Elements<TableCell>().ElementAt(1)
            .TableCellProperties!.GridSpan!.Val!.Value.Should().Be(2);
    }

    /// <summary>
    /// Numbers are written as text here, so the culture has to be pinned rather than inherited —
    /// otherwise a server under an invariant culture writes "0.5 l" and "4133.4 kg" into a Czech
    /// document, and the file differs between machines.
    /// </summary>
    [Fact]
    public void Build_WritesNumbersInCzech()
    {
        var body = Open(BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy", products:
            [
                new ShipmentExportProduct
                {
                    Name = "Pilsner Urquell", Kind = ProductKind.Bottle,
                    PackageSize = 0.5, Weight = 15.7, Quantity = 1200
                }
            ])
        ]));

        // A non-breaking space is what cs-CZ groups thousands with.
        TableRows(body, 0).Should().Contain(
            row => row[0] == "Hmotnost" && row[1].Replace(' ', ' ') == "18 840 kg",
            "decimal comma and a grouped thousand, not 18840");

        // Table 3, not 2: 0 is the overview summary, 1 the stop list, 2 the client's address block.
        var products = TableRows(body, 3);
        products[1][2].Should().Be("0,5 l", "decimal comma, not 0.5 l");
        products[1][3].Replace(' ', ' ').Should().Be("1 200 ks", "grouped thousand");
    }

    // "Celkem kusů" and the stop table's "Kusů" already name the unit; repeating it in the value reads
    // as "kusů: 4 ks". The product tables' "Množství" names none, so there it belongs.
    [Fact]
    public void Build_NamesEachUnitExactlyOnce()
    {
        var body = Open(BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy", products: [BuildProduct("Pilsner Urquell", 24)])
        ]));

        TableRows(body, 0).Should().Contain(row => row[0] == "Celkem kusů" && row[1] == "24");
        TableRows(body, 1)[1][3].Should().Be("24", "that column's header is already \"KUSŮ\"");
        TableRows(body, 3)[1][3].Should().Be("24 ks", "that column's header is only \"MNOŽSTVÍ\"");
    }

    // One driver is not a list of one.
    [Theory]
    [InlineData("Řidič", "Jan Novák")]
    [InlineData("Řidiči", "Jan Novák", "Petr Adamec")]
    public void Build_LabelsTheDriverRowForHowManyDrive(string expected, params string[] drivers)
    {
        var body = Open(BuildModel(driverNames: [.. drivers]));

        TableRows(body, 0).Should().Contain(row => row[0] == expected);
    }

    /// <summary>
    /// A long order spills past one page, and a column of bare quantities with no heading above it is
    /// what gets read into the wrong row.
    /// </summary>
    [Fact]
    public void Build_RepeatsTableHeadingsOnEveryPageAndKeepsRowsWhole()
    {
        var body = Open(BuildFullModel());

        foreach (var table in body.Elements<Table>())
        {
            var rows = table.Elements<TableRow>().ToList();

            // The label blocks are layout grids with no heading row; only the data tables repeat one.
            var isDataTable = rows[0].Elements<TableCell>()
                .Any(cell => cell.TableCellProperties?.Shading is not null);

            if (isDataTable)
                rows[0].TableRowProperties!.GetFirstChild<TableHeader>().Should().NotBeNull();

            rows.Should().OnlyContain(
                row => row.TableRowProperties!.GetFirstChild<CantSplit>() != null,
                "a row split across a page boundary is unreadable on paper");
        }
    }

    /// <summary>
    /// These pages get separated on purpose, one per stop. A loose sheet carrying only a client name
    /// says nothing about which run it came off.
    /// </summary>
    [Fact]
    public void Build_FootsEveryPageWithTheRunAndAPageNumber()
    {
        var stream = new MemoryStream(ShipmentExportDocumentBuilder.Build(BuildModel()));
        using var document = WordprocessingDocument.Open(stream, isEditable: false);

        var footer = document.MainDocumentPart!.FooterParts.Single().Footer!;

        footer.InnerText.Should().Contain("Pátek – Brno").And.Contain("3.8.2026").And.Contain("Strana");

        // Field codes rather than a computed number — only the reader knows the final page count.
        footer.Descendants<SimpleField>()
            .Select(field => field.Instruction!.Value!.Trim())
            .Should().Equal("PAGE", "NUMPAGES");

        document.MainDocumentPart.Document.Body!
            .Elements<SectionProperties>().Single()
            .Elements<FooterReference>()
            .Should().HaveCount(1, "the section has to point at the footer for it to appear");
    }

    [Fact]
    public void Build_ClientWithReturns_WritesThemAfterTheProducts()
    {
        var body = Open(BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy", returns:
            [
                new ShipmentExportReturn { Name = "Sud 30l KEG", Quantity = 6, Note = "poškozený ventil" }
            ])
        ]));

        var paragraphs = Paragraphs(body);
        paragraphs.Should().Contain("VRACÍ");

        var returns = TableRows(body, 4);
        returns[0].Should().Equal("POLOŽKA", "POZNÁMKA", "MNOŽSTVÍ");
        returns[1].Should().Equal("Sud 30l KEG", "poškozený ventil", "6 ks");
    }

    // Most vratky carry no note, and an always-present empty column reads as information that failed
    // to load rather than information that does not exist.
    [Fact]
    public void Build_ReturnsWithNoNotes_DropTheNoteColumnEntirely()
    {
        var body = Open(BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy", returns:
            [
                new ShipmentExportReturn { Name = "Basa", Quantity = 25 },
                new ShipmentExportReturn { Name = "Velký sud", Quantity = 3 }
            ])
        ]));

        var returns = TableRows(body, 4);

        returns[0].Should().Equal("POLOŽKA", "MNOŽSTVÍ");
        returns[1].Should().Equal("Basa", "25 ks");
        returns[2].Should().Equal("Velký sud", "3 ks");

        // The grid has to shrink with the columns, or the two remaining ones keep their old widths.
        sheetTable(body, 4).GetFirstChild<TableGrid>()!
            .Elements<GridColumn>().Should().HaveCount(2);
    }

    [Fact]
    public void Build_ClientWithNoReturnsOrNotes_LeavesThoseSectionsOutEntirely()
    {
        var body = Open(BuildModel());

        // An empty "Poznámky" row reads as "no instructions", which is a claim this page cannot
        // make; an empty "Vrací" heading reads the same way about returns.
        Paragraphs(body).Should().NotContain("VRACÍ");
        TableRows(body, 2).Should().NotContain(row => row[0] == "Poznámky");
    }

    [Fact]
    public void Build_StockPurchases_GetABlockOnTheOverviewRatherThanAPageOfTheirOwn()
    {
        var model = BuildModel(stockPurchases: [BuildProduct("Radegast", 3, ProductKind.Keg, 50)]);
        var body = Open(model);

        Paragraphs(body).Should().Contain("ZBOŽÍ NA SKLAD");

        // Nobody ordered them, so they take no page of their own: the one client is the only break.
        body.Descendants<Break>()
            .Count(b => b.Type?.Value == BreakValues.Page)
            .Should().Be(1);

        var purchases = TableRows(body, 2);
        purchases[1].Should().Equal("Radegast", "Sud", "50 l", "3 ks");
    }

    [Fact]
    public void Build_NoStockPurchases_OmitsTheBlock()
    {
        Paragraphs(Open(BuildModel())).Should().NotContain("ZBOŽÍ NA SKLAD");
    }

    [Fact]
    public void Build_ClientWithNoProducts_SaysSoRatherThanLeavingAnEmptyTable()
    {
        var body = Open(BuildModel(stops: [BuildStop(1, "Hospoda U Kotvy", products: [])]));

        Paragraphs(body).Should().Contain("Bez položek");
    }

    // The overview counts and the document are built from one model, so the two exports of the same
    // run cannot disagree about what is being delivered.
    [Fact]
    public void Build_CustomStop_GetsNoPageOfItsOwn()
    {
        var body = Open(BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy"),
            new ShipmentExportStop { Order = 2, Label = "Čerpací stanice" }
        ]));

        Paragraphs(body).Should().NotContain("2. Čerpací stanice");
    }
}
