using System.Security.Cryptography;
using System.Text;
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
        string? invoicedToClientName = null,
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
            InvoicedToClientName = invoicedToClientName,
            Notes = notes ?? [],
            Products = products ?? [BuildProduct("Pilsner Urquell", 24)],
            Returns = returns ?? []
        };

    /// <summary>
    /// A product row. <paramref name="invoicedQuantity"/> left null makes it a row nobody is billed
    /// for — the run's own stock purchases, which is the only shape that has no invoice behind it.
    /// </summary>
    private static ShipmentExportProduct BuildProduct(
        string name,
        int quantity,
        ProductKind? kind = ProductKind.Bottle,
        double? packageSize = 0.5,
        int? invoicedQuantity = null) =>
        new()
        {
            Name = name,
            Quantity = quantity,
            Kind = kind,
            PackageSize = packageSize,
            InvoicedQuantity = invoicedQuantity
        };

    private static ShipmentExportModel BuildModel(
        string name = "Pátek – Brno",
        DateTime? deliveryDate = null,
        string? vehicleName = "Iveco Daily",
        List<string>? driverNames = null,
        List<ShipmentExportStop>? stops = null,
        List<ShipmentExportProduct>? stockPurchases = null,
        List<ShipmentExportInvoice>? invoices = null) =>
        new()
        {
            ShipmentName = name,
            DeliveryDate = deliveryDate ?? new DateTime(2026, 8, 3, 0, 0, 0, DateTimeKind.Utc),
            VehicleName = vehicleName,
            DriverNames = driverNames ?? ["Jan Novák"],
            Stops = stops ?? [BuildStop(1, "Hospoda U Kotvy")],
            StockPurchases = stockPurchases ?? [],
            Invoices = invoices ?? []
        };

    private static ShipmentExportInvoiceParty BuildParty(
        string clientName,
        bool isPayer = false,
        List<ShipmentExportProduct>? products = null) =>
        new()
        {
            ClientName = clientName,
            IsPayer = isPayer,
            Products = products ?? [BuildProduct("Pilsner Urquell", 24)]
        };

    /// <summary>
    /// Deterministic ID for a client name, so invoices built with the same
    /// <paramref name="payingClientName"/> share an identity by default — pass
    /// <paramref name="payingClientId"/> explicitly to test two distinct clients sharing a name.
    /// </summary>
    private static ShipmentExportInvoice BuildInvoice(
        string payingClientName,
        int sequence,
        List<ShipmentExportInvoiceParty> parties,
        Guid? payingClientId = null,
        List<ShipmentExportBillingRecipient>? billingRecipients = null) =>
        new()
        {
            PayingClientName = payingClientName,
            PayingClientId = payingClientId ?? new Guid(MD5.HashData(Encoding.UTF8.GetBytes(payingClientName))),
            Sequence = sequence,
            Parties = parties,
            BillingRecipients = billingRecipients ?? []
        };

    private static ShipmentExportBillingRecipient BuildRecipient(
        string clientName, string street = "Hlavní 12", string cityLine = "602 00 Brno") =>
        new() { ClientName = clientName, Street = street, CityLine = cityLine };

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
        // extra with no product behind it, both product-table shapes, and the warehouse page.
        var stockGoods = new List<ShipmentExportProduct> { BuildProduct("Radegast", 3, ProductKind.Keg, 50) };

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
                        BuildProduct("Pilsner Urquell", 24, invoicedQuantity: 24),
                        BuildProduct("Slunečník", 2, kind: null, packageSize: null, invoicedQuantity: 0)
                    ],
                    returns: [new ShipmentExportReturn { Name = "Sud 30l KEG", Quantity = 6, Note = "prasklý" }]),
                new ShipmentExportStop { Order = 2, Label = "Čerpací stanice" },
                BuildStop(3, "Bez položek s.r.o.", products: []),
                new ShipmentExportStop
                {
                    Order = 4, IsWarehouse = true, Label = "AleTrack s.r.o.",
                    Street = "Skladová 7", CityLine = "460 01 Liberec", City = "Liberec",
                    Products = stockGoods
                }
            ],
            stockPurchases: stockGoods);

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

    [Fact]
    public void Build_StopPage_ReportsDeliveredAndBilledPiecesSideBySide()
    {
        var body = Open(BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy", products:
            [
                // Delivered and billed to the same client — the ordinary row.
                BuildProduct("Pilsner Urquell", 24, invoicedQuantity: 24),
                // Half of it billed to somebody else.
                BuildProduct("Kozel 11", 6, ProductKind.Keg, 30, invoicedQuantity: 2),
                // Cross-billed in: this client pays for pieces another stop receives.
                BuildProduct("Radegast", 0, ProductKind.Keg, 50, invoicedQuantity: 4)
            ])
        ]));

        var products = TableRows(body, 3);
        products[0].Should().Equal("PRODUKT", "DRUH", "BALENÍ", "SKUTEČNĚ", "FAKTURAČNĚ");
        products[1].Should().Equal("Pilsner Urquell", "Basa", "0,5 l", "24 ks", "24 ks");
        products[2].Should().Equal("Kozel 11", "Sud", "30 l", "6 ks", "2 ks");
        products[3].Should().Equal("Radegast", "Sud", "50 l", "0 ks", "4 ks");

        // Four cells across five columns: the kind and the package have nothing to total, so they
        // stay merged, and both quantity columns close with their own sum.
        products[4].Should().Equal("Celkem", string.Empty, "30 ks", "30 ks");
        sheetTable(body, 3).Elements<TableRow>().Last()
            .Elements<TableCell>().ElementAt(1)
            .TableCellProperties!.GridSpan!.Val!.Value.Should().Be(2);
    }

    /// <summary>
    /// Every column heading has to sit on one line: a header that wraps costs a row of height on
    /// every page the table runs onto, and reads as a broken word.
    /// </summary>
    /// <remarks>
    /// Two headers have already shipped wrapped — "FAKTURAČNĚ" in a column sized like its
    /// neighbour's, and "ZASTÁVKA" in a column sized for the stop number under it. Both are widths
    /// chosen for the values, forgetting that the heading above them is the longest text in the
    /// column.
    ///
    /// The width model is deliberately crude and deliberately pessimistic: <see cref="CapsWidth"/>
    /// measures against a wide serif rather than the declared Calibri, because a reader without
    /// Calibri substitutes its own and the file has to survive that. It cannot prove a header fits
    /// in Word, only that nobody sized a column below what the heading plainly needs.
    /// </remarks>
    [Fact]
    public void Build_EveryColumnHeading_IsGivenAColumnWideEnoughToHoldItOnOneLine()
    {
        var body = Open(BuildModel(
            stops:
            [
                BuildStop(1, "Hospoda U Kotvy", products: [BuildProduct("Pilsner Urquell", 24, invoicedQuantity: 24)],
                    returns: [new ShipmentExportReturn { Name = "Sud 30l KEG", Quantity = 6, Note = "prasklý" }]),
                BuildStop(2, "Pivnice Na Růhu", products: [BuildProduct("Kozel 11", 6, invoicedQuantity: 6)])
            ],
            stockPurchases: [BuildProduct("Radegast", 3, ProductKind.Keg, 50)]));

        var headed = body.Elements<Table>()
            .Where(table => table.Elements<TableRow>()
                .Any(row => row.TableRowProperties?.Elements<TableHeader>().Any() == true))
            .ToList();

        headed.Should().NotBeEmpty("the model above reaches every table that has a heading row");

        foreach (var table in headed)
        {
            var columns = table.GetFirstChild<TableGrid>()!
                .Elements<GridColumn>()
                .Select(column => int.Parse(column.Width!.Value!))
                .ToList();

            var headers = table.Elements<TableRow>()
                .First(row => row.TableRowProperties?.Elements<TableHeader>().Any() == true)
                .Elements<TableCell>()
                .Select(cell => cell.InnerText)
                .ToList();

            for (var i = 0; i < headers.Count; i++)
                columns[i].Should().BeGreaterThanOrEqualTo(CapsWidth(headers[i]), $"\"{headers[i]}\" has to fit its column");
        }
    }

    /// <summary>
    /// Twips a bold uppercase heading needs, cell padding included — 144 per character, which is a
    /// wide serif at the document's 10pt rather than Calibri's narrower caps.
    /// </summary>
    private static int CapsWidth(string header) => header.Length * 144 + 216;

    /// <summary>
    /// "FAKTURAČNĚ" is the longest header in the file and broke over two lines when its column was
    /// sized like its neighbour's.
    /// </summary>
    [Fact]
    public void Build_BilledColumn_IsTheWidestOfTheNarrowOnesAndKeepsTheTableOnThePage()
    {
        var body = Open(BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy", products: [BuildProduct("Pilsner Urquell", 24, invoicedQuantity: 24)])
        ]));

        var columns = sheetTable(body, 3).GetFirstChild<TableGrid>()!
            .Elements<GridColumn>()
            .Select(c => int.Parse(c.Width!.Value!))
            .ToList();

        columns.Should().HaveCount(5);
        columns.Sum().Should().Be(9000, "every table is sized to the same text width");

        // Wider than the delivered column beside it, which carries the shorter header.
        columns[4].Should().BeGreaterThan(columns[3]);
        columns[4].Should().BeGreaterThan(columns[1], "and wider than the kind and package columns");
        columns[4].Should().BeGreaterThan(columns[2]);
    }

    /// <summary>
    /// The run calls at our own warehouse to drop the goods bought for stock, so that stop reads
    /// like any other: a page of its own, a town and a piece count on the overview.
    /// </summary>
    [Fact]
    public void Build_WarehouseStop_GetsItsOwnPageAndTakesTheStockGoodsOffTheOverview()
    {
        var stockGoods = new List<ShipmentExportProduct> { BuildProduct("Radegast", 3, ProductKind.Keg, 50) };

        var body = Open(BuildModel(
            stops:
            [
                BuildStop(1, "Hospoda U Kotvy", products: [BuildProduct("Pilsner Urquell", 24, invoicedQuantity: 24)]),
                new ShipmentExportStop
                {
                    Order = 2, IsWarehouse = true, Label = "AleTrack s.r.o.",
                    Street = "Skladová 7", CityLine = "460 01 Liberec", City = "Liberec",
                    Products = stockGoods
                }
            ],
            stockPurchases: stockGoods));

        // The row that used to read "— —".
        var stops = TableRows(body, 1);
        stops.Should().Contain(row => row[1] == "AleTrack s.r.o." && row[2] == "Liberec" && row[3] == "3");

        // Not printed twice: the goods are the warehouse page's table now, so the overview's own
        // block is gone and the client page follows the stop table directly.
        Paragraphs(body).Should().NotContain("ZBOŽÍ NA SKLAD");
        Paragraphs(body).Should().Contain("2. AleTrack s.r.o.");

        // Tables: 0 summary, 1 stops, 2 the client's address block, 3 their goods, 4 the
        // warehouse's address block, 5 what comes off there.
        TableRows(body, 4).Should().Contain(row => row[0] == "Ulice" && row[1] == "Skladová 7");

        var stock = TableRows(body, 5);
        stock[0].Should().Equal("PRODUKT", "DRUH", "BALENÍ", "MNOŽSTVÍ");
        stock[1].Should().Equal("Radegast", "Sud", "50 l", "3 ks");
    }

    /// <summary>
    /// Nobody is billed for goods bought into our own warehouse, and a column of nothing but dashes
    /// reads as data that failed to load. This is also the fallback for a run that carries stock
    /// goods without a warehouse stop — one saved before the company stop existed.
    /// </summary>
    [Fact]
    public void Build_StockPurchasesWithNoWarehouseStop_KeepTheSingleQuantityColumnOnTheOverview()
    {
        var body = Open(BuildModel(
            stops: [BuildStop(1, "Hospoda U Kotvy", products: [BuildProduct("Pilsner Urquell", 24, invoicedQuantity: 24)])],
            stockPurchases: [BuildProduct("Radegast", 3, ProductKind.Keg, 50)]));

        // Table 2 on the overview: 0 is the summary, 1 the stop list, 2 the stock block — the stop
        // pages come after it.
        var stock = TableRows(body, 2);
        stock[0].Should().Equal("PRODUKT", "DRUH", "BALENÍ", "MNOŽSTVÍ");
        stock[1].Should().Equal("Radegast", "Sud", "50 l", "3 ks");
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

    [Fact]
    public void Build_ModelWithInvoices_WritesAFakturaceSectionPerPayer()
    {
        var payerParty = BuildParty(
            "Hospoda U Kotvy", isPayer: true, products: [BuildProduct("Pilsner Urquell", 24)]);
        var otherParty = BuildParty(
            "Pivnice Na Rohu", products: [BuildProduct("Kozel 11", 6, ProductKind.Keg, 30)]);

        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties: [payerParty, otherParty])
        ]);

        var body = Open(model);
        var paragraphs = Paragraphs(body);

        // The payer holds only this one invoice, so the heading carries no "Faktura 1" suffix —
        // matching the workbook's rule exactly.
        paragraphs.Should().Contain("Fakturace: Hospoda U Kotvy");
        paragraphs.Should().Contain("HOSPODA U KOTVY · VLASTNÍ ZBOŽÍ");
        paragraphs.Should().Contain("PIVNICE NA ROHU");
        paragraphs.Should().Contain("Celkem Hospoda U Kotvy: 24 ks");
        paragraphs.Should().Contain("Celkem Pivnice Na Rohu: 6 ks");
        paragraphs.Should().Contain("Celkem faktura: 30 ks");
    }

    [Fact]
    public void Build_ClientWithTwoInvoices_LabelsEachWithItsSequence()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)]),
            BuildInvoice("Hospoda U Kotvy", sequence: 2, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)]),
            BuildInvoice("Pivnice Na Rohu", sequence: 1, parties: [BuildParty("Pivnice Na Rohu", isPayer: true)])
        ]);

        var paragraphs = Paragraphs(Open(model));

        paragraphs.Should().Contain("Fakturace: Hospoda U Kotvy · Faktura 1");
        paragraphs.Should().Contain("Fakturace: Hospoda U Kotvy · Faktura 2");

        // The one-invoice payer gets a bare heading — no meaningless "Faktura 1".
        paragraphs.Should().Contain("Fakturace: Pivnice Na Rohu");
        paragraphs.Should().NotContain("Fakturace: Pivnice Na Rohu · Faktura 1");
    }

    /// <summary>
    /// Two distinct clients can genuinely share a name (that is what <c>BusinessName</c> exists
    /// for), and each holding exactly one invoice here must not be mistaken for the same client
    /// holding two — which would wrongly suffix both with "Faktura 1".
    /// </summary>
    [Fact]
    public void Build_TwoDistinctClientsSharingAName_NeitherGetsASequenceSuffix()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)], payingClientId: Guid.NewGuid()),
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)], payingClientId: Guid.NewGuid())
        ]);

        var paragraphs = Paragraphs(Open(model));

        paragraphs.Should().Contain("Fakturace: Hospoda U Kotvy");
        paragraphs.Should().NotContain("Fakturace: Hospoda U Kotvy · Faktura 1");
    }

    [Fact]
    public void Build_ModelWithoutInvoices_WritesNoFakturaceSection()
    {
        var body = Open(BuildModel());

        body.InnerText.Should().NotContain("Fakturace");
    }

    [Fact]
    public void Build_InvoiceWithBillingRecipients_WritesTheSectionWithNamesAndAddresses()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice(
                "Hospoda U Kotvy", sequence: 1,
                parties: [BuildParty("Hospoda U Kotvy", isPayer: true)],
                billingRecipients:
                [
                    BuildRecipient("Bar Na Rohu", "Nádražní 5", "110 00 Praha"),
                    BuildRecipient("Hospoda U Lípy", "Hlavní 12", "602 00 Brno")
                ])
        ]);

        var body = Open(model);
        var paragraphs = Paragraphs(body);

        paragraphs.Should().Contain("FAKTURAČNÍ ADRESA PRO HOSPODA U KOTVY");

        var recipients = TableRows(body, IndexOfRecipientsTable(body));
        recipients[0].Should().Equal("KLIENT", "ADRESA");
        recipients.Should().Contain(row => row[0] == "Bar Na Rohu" && row[1] == "Nádražní 5, 110 00 Praha");
        recipients.Should().Contain(row => row[0] == "Hospoda U Lípy" && row[1] == "Hlavní 12, 602 00 Brno");
    }

    [Fact]
    public void Build_InvoiceWithNoBillingRecipients_WritesNoSection()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)])
        ]);

        var body = Open(model);

        body.InnerText.Should().NotContain("Fakturační adresa");
    }

    /// <summary>
    /// Extends the load-bearing adjacency rule to the billing-recipients table: it must never sit
    /// directly against the neighbouring party table, nor be the last element before sectPr.
    /// </summary>
    [Fact]
    public void Build_BillingRecipientsTable_IsNeverAdjacentToAnotherTable()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice(
                "Hospoda U Kotvy", sequence: 1,
                parties: [BuildParty("Hospoda U Kotvy", isPayer: true, products: [BuildProduct("Pilsner Urquell", 24)])],
                billingRecipients: [BuildRecipient("Bar Na Rohu")])
        ]);

        var body = Open(model);

        var children = body.ChildElements.ToList();
        var adjacent = children
            .Zip(children.Skip(1))
            .Count(pair => pair.First is Table && pair.Second is Table);

        adjacent.Should().Be(0);
        children[^2].Should().NotBeOfType<Table>("a table cannot be the last content before sectPr");
    }

    /// <summary>Index of the first table after the last party-products table of the document.</summary>
    private static int IndexOfRecipientsTable(Body body) => body.Elements<Table>().Count() - 1;

    /// <summary>
    /// The load-bearing rule this file documents: Word merges two tables that touch. Checked over
    /// the whole body, not just the invoice section — the invoice pages follow the stop pages, and
    /// an adjacency slipping in at that seam would be missed by a check scoped to one section.
    /// </summary>
    [Fact]
    public void Build_FakturaceTables_AreNeverAdjacent()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
            [
                BuildParty("Hospoda U Kotvy", isPayer: true, products: [BuildProduct("Pilsner Urquell", 24)]),
                BuildParty("Pivnice Na Rohu", products: [BuildProduct("Kozel 11", 6, ProductKind.Keg, 30)])
            ])
        ]);

        var body = Open(model);

        var children = body.ChildElements.ToList();
        var adjacent = children
            .Zip(children.Skip(1))
            .Count(pair => pair.First is Table && pair.Second is Table);

        adjacent.Should().Be(0);
        children[^2].Should().NotBeOfType<Table>("a table cannot be the last content before sectPr");
    }

    [Fact]
    public void Build_SubClientStopPage_NamesThePayer()
    {
        var body = Open(BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy", invoicedToClientName: "Pivnice Na Rohu")
        ]));

        var details = TableRows(body, 2);
        details.Should().Contain(row => row[0] == "Fakturováno na" && row[1] == "Pivnice Na Rohu");
    }

    [Fact]
    public void Build_StopWithNoPayer_OmitsTheInvoicedToRow()
    {
        var body = Open(BuildModel(stops: [BuildStop(1, "Hospoda U Kotvy")]));

        var details = TableRows(body, 2);
        details.Should().NotContain(row => row[0] == "Fakturováno na");
    }
}
