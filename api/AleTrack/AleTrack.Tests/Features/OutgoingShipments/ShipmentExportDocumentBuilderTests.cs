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
/// What the shipment export document contains: the run's overview and route, then a page per
/// confirmed invoice.
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
        string? city = "Brno",
        List<ShipmentExportProduct>? products = null) =>
        new()
        {
            Order = order,
            ClientName = clientName,
            City = city,
            Products = products ?? [BuildProduct("Pilsner Urquell", 24)]
        };

    private static ShipmentExportProduct BuildProduct(
        string name,
        int quantity,
        ProductKind? kind = ProductKind.Bottle,
        double? packageSize = 0.5) =>
        new()
        {
            Name = name,
            Quantity = quantity,
            Kind = kind,
            PackageSize = packageSize
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

    /// <summary>
    /// One party of an invoice. The delivery details default to none, which is the shape of a party
    /// whose goods this run only bills.
    /// </summary>
    private static ShipmentExportInvoiceParty BuildParty(
        string clientName,
        bool isPayer = false,
        List<ShipmentExportProduct>? products = null,
        string? street = null,
        string? cityLine = null,
        string? deliveryPlaceName = null,
        List<string>? notes = null,
        List<ShipmentExportReturn>? returns = null) =>
        new()
        {
            ClientName = clientName,
            IsPayer = isPayer,
            Street = street,
            CityLine = cityLine,
            DeliveryPlaceName = deliveryPlaceName,
            Notes = notes ?? [],
            Returns = returns ?? [],
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
        int number = 1,
        Guid? payingClientId = null,
        List<ShipmentExportBillingRecipient>? billingRecipients = null) =>
        new()
        {
            Number = number,
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

    /// <summary>Rows of a table by its first heading cell, for the ones whose index moves.</summary>
    private static List<List<string>> TableHeaded(Body body, string firstHeader) =>
        body.Elements<Table>()
            .Select(table => table.Elements<TableRow>()
                .Select(row => row.Elements<TableCell>().Select(c => c.InnerText).ToList())
                .ToList())
            .First(rows => rows[0][0] == firstHeader);

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
        // Exercised over a model that reaches every branch: a custom stop, the warehouse, the stock
        // block, a party with an address, notes, returns and a custom extra with no product behind
        // it, a party with no delivery at all, and a party with no goods.
        var stockGoods = new List<ShipmentExportProduct> { BuildProduct("Radegast", 3, ProductKind.Keg, 50) };

        var model = BuildModel(
            stops:
            [
                BuildStop(1, "Hospoda U Kotvy"),
                new ShipmentExportStop { Order = 2, Label = "Čerpací stanice" },
                new ShipmentExportStop
                {
                    Order = 3, IsWarehouse = true, Label = "AleTrack s.r.o.",
                    City = "Liberec", Products = stockGoods
                }
            ],
            stockPurchases: stockGoods,
            invoices:
            [
                BuildInvoice(
                    "Hospoda U Kotvy", sequence: 1,
                    parties:
                    [
                        BuildParty(
                            "Hospoda U Kotvy", isPayer: true,
                            street: "Dlouhá 14", cityLine: "602 00 Brno", deliveryPlaceName: "Zahrádka",
                            notes: ["Volat 30 min předem", "Brána z boku"],
                            products:
                            [
                                BuildProduct("Pilsner Urquell", 24),
                                BuildProduct("Slunečník", 2, kind: null, packageSize: null)
                            ],
                            returns: [new ShipmentExportReturn { Name = "Sud 30l KEG", Quantity = 6, Note = "prasklý" }]),
                        BuildParty("Pivnice Na Rohu", products: [BuildProduct("Kozel 11", 6, ProductKind.Keg, 30)])
                    ],
                    billingRecipients: [BuildRecipient("Bar Na Rohu")]),
                BuildInvoice("Bez položek s.r.o.", sequence: 1, number: 2, parties:
                [
                    BuildParty("Bez položek s.r.o.", isPayer: true, products: [])
                ])
            ]);

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
                BuildStop(1, "Hospoda U Kotvy"),
                new ShipmentExportStop { Order = 2, Label = "Čerpací stanice" }
            ],
            stockPurchases: [BuildProduct("Radegast", 3, ProductKind.Keg, 50)],
            invoices:
            [
                BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
                [
                    BuildParty(
                        "Hospoda U Kotvy", isPayer: true,
                        street: "Dlouhá 14", cityLine: "602 00 Brno", deliveryPlaceName: "Zahrádka",
                        notes: ["Volat 30 min předem"],
                        returns: [new ShipmentExportReturn { Name = "Sud 30l KEG", Quantity = 6 }])
                ]),
                BuildInvoice("Bez položek s.r.o.", sequence: 1, number: 2, parties:
                [
                    BuildParty("Bez položek s.r.o.", isPayer: true, products: [])
                ])
            ]);

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
    /// Word merges two tables that sit directly against each other, which ran a party's address
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
    /// One hard break per invoice and nowhere else, each immediately before that invoice's heading.
    /// </summary>
    /// <remarks>
    /// Asserted on an explicit <c>w:br w:type="page"</c> run rather than on <c>pageBreakBefore</c>:
    /// the latter is a hint readers outside Word ignore, which is what ran every page onto the
    /// previous one.
    /// </remarks>
    [Fact]
    public void Build_StartsEachInvoiceOnAFreshPage()
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
            model.Invoices.Count,
            "one break per invoice — the overview keeps the first page, and a stop no longer has one");

        // Each break is followed directly by the heading of the invoice it opens, so no content can
        // slip onto the previous page.
        breakIndices.Select(index => children[index + 1].InnerText)
            .Should().Equal("Fakturace: 1 · Hospoda U Kotvy", "Fakturace: 2 · Bez položek s.r.o.");
    }

    // Both mechanisms together would break twice and leave a blank page between every invoice.
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

    /// <summary>
    /// The route table is the driver's page, so it lists the whole run — including a client whose
    /// row nobody has confirmed and which therefore has no invoice page.
    /// </summary>
    [Fact]
    public void Build_Overview_ListsAStopWhoseRowIsNotConfirmed()
    {
        var body = Open(BuildModel(
            stops: [BuildStop(1, "Hospoda U Kotvy"), BuildStop(2, "Pivnice Na Růhu", city: "Olomouc")],
            invoices:
            [
                BuildInvoice("Pivnice Na Růhu", sequence: 1, parties: [BuildParty("Pivnice Na Růhu", isPayer: true)])
            ]));

        TableRows(body, 1).Should().Contain(row => row[1] == "Hospoda U Kotvy");
        Paragraphs(body).Should().NotContain("Fakturace: 1 · Hospoda U Kotvy");
    }

    [Fact]
    public void Build_InvoicePage_CarriesWhereTheGoodsWentAndTheProductsWithATotal()
    {
        var body = Open(BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
            [
                BuildParty(
                    "Hospoda U Kotvy",
                    isPayer: true,
                    street: "Dlouhá 14",
                    cityLine: "602 00 Brno",
                    deliveryPlaceName: "Zahrádka",
                    notes: ["Volat 30 min předem", "Brána z boku"],
                    products:
                    [
                        BuildProduct("Pilsner Urquell", 24),
                        BuildProduct("Kozel 11", 6, ProductKind.Keg, 30),
                        // A custom extra: ordered all the same, but with no product behind it.
                        BuildProduct("Slunečník", 2, kind: null, packageSize: null)
                    ])
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
    /// A party the run only bills — its own delivery went out on another run — has no address block
    /// at all, rather than one full of dashes.
    /// </summary>
    [Fact]
    public void Build_PartyWithNoDelivery_WritesNoAddressBlock()
    {
        var body = Open(BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)])
        ]));

        // Tables: 0 the summary, 1 the route, 2 the party's goods — no label block in between.
        TableRows(body, 2)[0].Should().Equal("PRODUKT", "DRUH", "BALENÍ", "MNOŽSTVÍ");
        Paragraphs(body).Should().NotContain("VRACÍ");
    }

    /// <summary>
    /// Every column heading has to sit on one line: a header that wraps costs a row of height on
    /// every page the table runs onto, and reads as a broken word.
    /// </summary>
    /// <remarks>
    /// "ZASTÁVKA" has already shipped wrapped, in a column sized for the stop number under it — a
    /// width chosen for the values, forgetting that the heading above them is the longest text in
    /// the column.
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
            stops: [BuildStop(1, "Hospoda U Kotvy")],
            stockPurchases: [BuildProduct("Radegast", 3, ProductKind.Keg, 50)],
            invoices:
            [
                BuildInvoice(
                    "Hospoda U Kotvy", sequence: 1,
                    parties:
                    [
                        BuildParty(
                            "Hospoda U Kotvy", isPayer: true,
                            returns: [new ShipmentExportReturn { Name = "Sud 30l KEG", Quantity = 6, Note = "prasklý" }])
                    ],
                    billingRecipients: [BuildRecipient("Bar Na Rohu")])
            ]));

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
    /// Every table is sized to the same text width, so none of them runs off the page.
    /// </summary>
    [Fact]
    public void Build_EveryTable_IsSizedToTheTextWidth()
    {
        var body = Open(BuildFullModel());

        foreach (var table in body.Elements<Table>())
        {
            table.GetFirstChild<TableGrid>()!
                .Elements<GridColumn>()
                .Sum(column => int.Parse(column.Width!.Value!))
                .Should().Be(9000);
        }
    }

    /// <summary>
    /// The run calls at our own warehouse to drop the goods bought for stock, so the route table
    /// reports that stop's town and piece count like any other.
    /// </summary>
    [Fact]
    public void Build_WarehouseStop_ReportsItsGoodsOnTheRouteTableInsteadOfTheStockBlock()
    {
        var stockGoods = new List<ShipmentExportProduct> { BuildProduct("Radegast", 3, ProductKind.Keg, 50) };

        var body = Open(BuildModel(
            stops:
            [
                BuildStop(1, "Hospoda U Kotvy"),
                new ShipmentExportStop
                {
                    Order = 2, IsWarehouse = true, Label = "AleTrack s.r.o.",
                    City = "Liberec", Products = stockGoods
                }
            ],
            stockPurchases: stockGoods));

        // The row that used to read "— —".
        var stops = TableRows(body, 1);
        stops.Should().Contain(row => row[1] == "AleTrack s.r.o." && row[2] == "Liberec" && row[3] == "3");

        // Not counted twice: the route table above already reports these pieces.
        Paragraphs(body).Should().NotContain("ZBOŽÍ NA SKLAD");
    }

    /// <summary>
    /// The fallback for a run that carries stock goods without a warehouse stop — one saved before
    /// the company stop existed.
    /// </summary>
    [Fact]
    public void Build_StockPurchasesWithNoWarehouseStop_GetABlockOnTheOverview()
    {
        var body = Open(BuildModel(
            stops: [BuildStop(1, "Hospoda U Kotvy")],
            stockPurchases: [BuildProduct("Radegast", 3, ProductKind.Keg, 50)]));

        // Table 2 on the overview: 0 is the summary, 1 the route table, 2 the stock block.
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
        var heavy = new ShipmentExportProduct
        {
            Name = "Pilsner Urquell", Kind = ProductKind.Bottle,
            PackageSize = 0.5, Weight = 15.7, Quantity = 1200
        };

        var body = Open(BuildModel(
            stops: [BuildStop(1, "Hospoda U Kotvy", products: [heavy])],
            invoices:
            [
                BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
                [
                    BuildParty("Hospoda U Kotvy", isPayer: true, products: [heavy])
                ])
            ]));

        // A non-breaking space is what cs-CZ groups thousands with.
        TableRows(body, 0).Should().Contain(
            row => row[0] == "Hmotnost" && row[1].Replace('\u00A0', ' ') == "18 840 kg",
            "decimal comma and a grouped thousand, not 18840");

        var products = TableHeaded(body, "PRODUKT");
        products[1][2].Should().Be("0,5 l", "decimal comma, not 0.5 l");
        products[1][3].Replace('\u00A0', ' ').Should().Be("1 200 ks", "grouped thousand");
    }

    // "Celkem kusů" and the route table's "Kusů" already name the unit; repeating it in the value
    // reads as "kusů: 4 ks". The product tables' "Množství" names none, so there it belongs.
    [Fact]
    public void Build_NamesEachUnitExactlyOnce()
    {
        var body = Open(BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)])
        ]));

        TableRows(body, 0).Should().Contain(row => row[0] == "Celkem kusů" && row[1] == "24");
        TableRows(body, 1)[1][3].Should().Be("24", "that column's header is already \"KUSŮ\"");
        TableHeaded(body, "PRODUKT")[1][3].Should().Be("24 ks", "that column's header is only \"MNOŽSTVÍ\"");
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
    /// A long invoice spills past one page, and a column of bare quantities with no heading above it
    /// is what gets read into the wrong row.
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
    /// These pages get separated on purpose, one per invoice. A loose sheet carrying only a client
    /// name says nothing about which run it came off.
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
    public void Build_PartyWithReturns_WritesThemAfterTheProducts()
    {
        var body = Open(BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
            [
                BuildParty("Hospoda U Kotvy", isPayer: true, returns:
                [
                    new ShipmentExportReturn { Name = "Sud 30l KEG", Quantity = 6, Note = "poškozený ventil" }
                ])
            ])
        ]));

        var paragraphs = Paragraphs(body);
        paragraphs.Should().Contain("VRACÍ");
        paragraphs.IndexOf("VRACÍ").Should().BeGreaterThan(
            paragraphs.IndexOf("Celkem Hospoda U Kotvy: 24 ks"),
            "what goes back reads after what is delivered");

        var returns = TableHeaded(body, "POLOŽKA");
        returns[0].Should().Equal("POLOŽKA", "POZNÁMKA", "MNOŽSTVÍ");
        returns[1].Should().Equal("Sud 30l KEG", "poškozený ventil", "6 ks");
    }

    // Most vratky carry no note, and an always-present empty column reads as information that failed
    // to load rather than information that does not exist.
    [Fact]
    public void Build_ReturnsWithNoNotes_DropTheNoteColumnEntirely()
    {
        var body = Open(BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
            [
                BuildParty("Hospoda U Kotvy", isPayer: true, returns:
                [
                    new ShipmentExportReturn { Name = "Basa", Quantity = 25 },
                    new ShipmentExportReturn { Name = "Velký sud", Quantity = 3 }
                ])
            ])
        ]));

        var returns = TableHeaded(body, "POLOŽKA");

        returns[0].Should().Equal("POLOŽKA", "MNOŽSTVÍ");
        returns[1].Should().Equal("Basa", "25 ks");
        returns[2].Should().Equal("Velký sud", "3 ks");

        // The grid has to shrink with the columns, or the two remaining ones keep their old widths.
        body.Elements<Table>().Last().GetFirstChild<TableGrid>()!
            .Elements<GridColumn>().Should().HaveCount(2);
    }

    [Fact]
    public void Build_PartyWithNoReturnsOrNotes_LeavesThoseSectionsOutEntirely()
    {
        var body = Open(BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
            [
                BuildParty("Hospoda U Kotvy", isPayer: true, street: "Dlouhá 14", cityLine: "602 00 Brno")
            ])
        ]));

        // An empty "Poznámky" row reads as "no instructions", which is a claim this page cannot
        // make; an empty "Vrací" heading reads the same way about returns.
        Paragraphs(body).Should().NotContain("VRACÍ");
        TableRows(body, 2).Should().NotContain(row => row[0] == "Poznámky");
    }

    [Fact]
    public void Build_StockPurchases_GetABlockOnTheOverviewRatherThanAPageOfTheirOwn()
    {
        var model = BuildModel(
            stockPurchases: [BuildProduct("Radegast", 3, ProductKind.Keg, 50)],
            invoices:
            [
                BuildInvoice("Hospoda U Kotvy", sequence: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)])
            ]);

        var body = Open(model);

        Paragraphs(body).Should().Contain("ZBOŽÍ NA SKLAD");

        // Nobody is billed for them, so they open no page of their own: the one invoice is the only
        // break.
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
    public void Build_PartyWithNoProducts_SaysSoRatherThanLeavingAnEmptyTable()
    {
        var body = Open(BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
            [
                BuildParty("Hospoda U Kotvy", isPayer: true, products: [])
            ])
        ]));

        Paragraphs(body).Should().Contain("Bez položek");
    }

    /// <summary>
    /// The stops are the driver's page and are read off the overview's route table — none of them
    /// takes a page of its own any more, custom or not.
    /// </summary>
    [Fact]
    public void Build_Stops_GetNoPagesOfTheirOwn()
    {
        var body = Open(BuildModel(stops:
        [
            BuildStop(1, "Hospoda U Kotvy"),
            new ShipmentExportStop { Order = 2, Label = "Čerpací stanice" }
        ]));

        var paragraphs = Paragraphs(body);
        paragraphs.Should().NotContain("1. Hospoda U Kotvy");
        paragraphs.Should().NotContain("2. Čerpací stanice");
        body.Descendants<Break>().Should().BeEmpty("nothing but an invoice opens a page");
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
            BuildInvoice("Hospoda U Kotvy", sequence: 1, number: 2, parties: [payerParty, otherParty])
        ]);

        var body = Open(model);
        var paragraphs = Paragraphs(body);

        // The payer holds only this one invoice, so the heading carries no "Faktura 1" suffix — but
        // it does lead with the number the office confirmed the row under, matching the workbook's
        // rule exactly.
        paragraphs.Should().Contain("Fakturace: 2 · Hospoda U Kotvy");
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
            BuildInvoice("Hospoda U Kotvy", sequence: 1, number: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)]),
            BuildInvoice("Hospoda U Kotvy", sequence: 2, number: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)]),
            BuildInvoice("Pivnice Na Rohu", sequence: 1, number: 2, parties: [BuildParty("Pivnice Na Rohu", isPayer: true)])
        ]);

        var paragraphs = Paragraphs(Open(model));

        // Both pages of one client share its number — it is one confirmed row — so the sequence is
        // what tells them apart.
        paragraphs.Should().Contain("Fakturace: 1 · Hospoda U Kotvy · Faktura 1");
        paragraphs.Should().Contain("Fakturace: 1 · Hospoda U Kotvy · Faktura 2");

        // The one-invoice payer gets no meaningless "Faktura 1".
        paragraphs.Should().Contain("Fakturace: 2 · Pivnice Na Rohu");
        paragraphs.Should().NotContain("Fakturace: 2 · Pivnice Na Rohu · Faktura 1");
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
            BuildInvoice("Hospoda U Kotvy", sequence: 1, number: 1, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)], payingClientId: Guid.NewGuid()),
            BuildInvoice("Hospoda U Kotvy", sequence: 1, number: 2, parties: [BuildParty("Hospoda U Kotvy", isPayer: true)], payingClientId: Guid.NewGuid())
        ]);

        var paragraphs = Paragraphs(Open(model));

        // Their own numbers are what keep them apart, not a sequence suffix neither has earned.
        paragraphs.Should().Contain("Fakturace: 1 · Hospoda U Kotvy");
        paragraphs.Should().Contain("Fakturace: 2 · Hospoda U Kotvy");
        paragraphs.Should().NotContain(text => text.Contains("· Faktura"));
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

        var recipients = TableHeaded(body, "KLIENT");
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

    /// <summary>
    /// The load-bearing rule this file documents: Word merges two tables that touch. Checked over a
    /// party carrying every block it can have — an address grid, its goods and its vratky — since
    /// those three tables follow each other directly.
    /// </summary>
    [Fact]
    public void Build_FakturaceTables_AreNeverAdjacent()
    {
        var model = BuildModel(invoices:
        [
            BuildInvoice("Hospoda U Kotvy", sequence: 1, parties:
            [
                BuildParty(
                    "Hospoda U Kotvy", isPayer: true,
                    street: "Dlouhá 14", cityLine: "602 00 Brno",
                    products: [BuildProduct("Pilsner Urquell", 24)],
                    returns: [new ShipmentExportReturn { Name = "Sud 30l KEG", Quantity = 6 }]),
                BuildParty(
                    "Pivnice Na Rohu",
                    street: "Nádražní 5", cityLine: "110 00 Praha",
                    products: [BuildProduct("Kozel 11", 6, ProductKind.Keg, 30)])
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
}
