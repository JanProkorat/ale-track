using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using static AleTrack.Features.OutgoingShipments.Queries.Export.ShipmentExportLabels;

namespace AleTrack.Features.OutgoingShipments.Queries.Export;

/// <summary>
/// Writes a <see cref="ShipmentExportModel"/> out as a .docx document: the run's overview, then one
/// page per confirmed invoice.
/// </summary>
/// <remarks>
/// The same content as <see cref="ShipmentExportWorkbookBuilder"/>, laid out for a document rather
/// than a grid — an invoice gets a page with a heading rather than a block on a worksheet, because
/// this is the version that gets printed and handed over.
///
/// Formatting is applied directly to the runs; the styles part carries nothing but document-wide
/// defaults, because there is not enough variation here for named styles to earn the indirection.
///
/// Four details are load-bearing rather than cosmetic, and each has a test of its own: the body ends
/// in a <c>sectPr</c> declaring the page (without it a reader has no page to lay content out against
/// and gives every table a sheet of its own), no two tables ever sit directly against each other
/// (Word merges those into one), each table carries a <c>tblGrid</c>, and clients are separated by an
/// explicit page-break run rather than by <c>pageBreakBefore</c> (see <see cref="PageBreak"/>).
/// </remarks>
public static class ShipmentExportDocumentBuilder
{
    /// <summary>Half-points, as Word measures font size. 20 = 10pt.</summary>
    private const string BodyFontSize = "20";

    private const string HeadingFontSize = "28";

    private const string FooterFontSize = "16";

    /// <summary>
    /// Column widths in twentieths of a point, summing to the text width of a portrait A4 page at
    /// Word's default margins.
    /// </summary>
    /// <remarks>
    /// Every table needs a <c>tblGrid</c>: it is required by the schema, and Word repairs — rather
    /// than opens — a table without one.
    /// </remarks>
    private static readonly int[] LabelColumns = [2400, 6600];

    private static readonly int[] ProductColumns = [4200, 1500, 1500, 1800];

    /// <summary>
    /// Widths for a product table that also reports what is delivered — see WriteProductTable. The
    /// product name gives up the room the extra column needs; it is the one that can wrap.
    /// </summary>
    /// <remarks>
    /// The billed column is the widest of the four narrow ones on purpose: "FAKTURAČNĚ" is the
    /// longest header in the file, and at 1550 it broke over two lines — measured against a
    /// substituted serif rather than the declared Calibri, because a reader without Calibri picks
    /// its own and every viewer must render the header on one line.
    /// </remarks>
    private static readonly int[] ProductColumnsWithDelivered = [2800, 1300, 1300, 1650, 1950];

    /// <summary>
    /// Stop number needs far less room than the town it is in — but not less than its own header:
    /// at 1000 the column was sized for the value and broke "ZASTÁVKA" over two lines.
    /// </summary>
    private static readonly int[] StopColumns = [1450, 3600, 2650, 1300];

    private static readonly int[] ReturnColumns = [3600, 3600, 1800];

    /// <summary>Widths for a returns table whose items carry no notes — see WriteReturnsTable.</summary>
    private static readonly int[] ReturnColumnsWithoutNotes = [6600, 2400];

    private static readonly int[] BillingRecipientColumns = [3000, 6000];

    /// <summary>Header-row fill, matching the workbook's.</summary>
    private const string HeaderFill = "F2F2F2";

    /// <summary>
    /// Builds the document and returns its bytes.
    /// </summary>
    public static byte[] Build(ShipmentExportModel model)
    {
        using var stream = new MemoryStream();

        using (var document = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document))
        {
            var mainPart = document.AddMainDocumentPart();
            WriteStyles(mainPart);

            var body = new Body();

            WriteOverview(body, model);
            WriteInvoicePages(body, model);

            // Last child of the body, as the schema requires. Without it the document declares no
            // page size or margins at all, and a reader with no page to lay out against pushes each
            // fixed-width table onto a sheet of its own — which is what put one client's heading,
            // address and goods on three separate pages.
            var setup = PageSetup();
            WriteFooter(mainPart, model, setup);
            body.AppendChild(setup);

            mainPart.Document = new Document(body);
        }

        return stream.ToArray();
    }

    /// <summary>
    /// A4 portrait with 2 cm margins, leaving 9638 twips of text width for the 9000-twip tables.
    /// </summary>
    private static SectionProperties PageSetup() =>
        new(
            new PageSize { Width = 11906, Height = 16838 },
            new PageMargin
            {
                Top = 1134, Bottom = 1134, Left = 1134, Right = 1134, Header = 720, Footer = 720, Gutter = 0
            });

    /// <summary>
    /// Footer naming the run and numbering the pages.
    /// </summary>
    /// <remarks>
    /// The pages of this document get separated on purpose — one per invoice, filed per client — and
    /// a loose sheet carrying nothing but a client name says nothing about which run it came off.
    /// The footer is what keeps a page identifiable once it leaves the stack.
    ///
    /// The reference goes at the front of the section properties: sectPr's header and footer
    /// references precede the page geometry in the schema's sequence.
    /// </remarks>
    private static void WriteFooter(MainDocumentPart mainPart, ShipmentExportModel model, SectionProperties setup)
    {
        var part = mainPart.AddNewPart<FooterPart>();

        part.Footer = new Footer(new Paragraph(
            new ParagraphProperties(
                new SpacingBetweenLines { Before = "120", After = "0" },
                new Justification { Val = JustificationValues.Center }),
            Run($"{model.ShipmentName} · {Date(model.DeliveryDate)} · Strana ", fontSize: FooterFontSize),
            // Field codes rather than a computed number: the reader knows how many pages it ended up
            // laying out, and this writer does not. The cached run is what shows before a recalc.
            PageNumberField(" PAGE "),
            Run(" z ", fontSize: FooterFontSize),
            PageNumberField(" NUMPAGES ")));

        part.Footer.Save();

        setup.PrependChild(new FooterReference
        {
            Id = mainPart.GetIdOfPart(part), Type = HeaderFooterValues.Default
        });
    }

    private static SimpleField PageNumberField(string instruction) =>
        new(Run("1", fontSize: FooterFontSize)) { Instruction = instruction };

    /// <summary>
    /// Document-wide defaults, so text has a defined font and line spacing rather than whatever the
    /// reader happens to fall back to.
    /// </summary>
    private static void WriteStyles(MainDocumentPart mainPart)
    {
        var part = mainPart.AddNewPart<StyleDefinitionsPart>();

        part.Styles = new Styles(
            new DocDefaults(
                new RunPropertiesDefault(
                    new RunPropertiesBaseStyle(
                        new RunFonts { Ascii = "Calibri", HighAnsi = "Calibri" },
                        new FontSize { Val = BodyFontSize },
                        new FontSizeComplexScript { Val = BodyFontSize })),
                new ParagraphPropertiesDefault(
                    new ParagraphPropertiesBaseStyle(
                        new SpacingBetweenLines
                        {
                            After = "0", Line = "240", LineRule = LineSpacingRuleValues.Auto
                        }))));

        part.Styles.Save();
    }

    private static void WriteOverview(Body body, ShipmentExportModel model)
    {
        body.AppendChild(Heading(model.ShipmentName));

        var summary = LabelTable();
        summary.AppendChild(LabelRow("Datum dodání", Date(model.DeliveryDate)));
        summary.AppendChild(LabelRow("Vozidlo", model.VehicleName ?? Missing));
        // Singular when one drives, so a one-driver run does not read as a list of one.
        summary.AppendChild(LabelRow(
            model.DriverNames.Count == 1 ? "Řidič" : "Řidiči",
            model.DriverNames.Count > 0 ? string.Join(", ", model.DriverNames) : Missing));
        summary.AppendChild(LabelRow("Zastávek", Number(model.Stops.Count)));
        summary.AppendChild(LabelRow("Klientů", Number(model.ClientStops.Count())));
        // The unit is named once, never twice: bare here because "Celkem kusů" already says "ks",
        // spelled out under the product tables' "Množství", which names no unit of its own.
        summary.AppendChild(LabelRow("Celkem kusů", Number(model.TotalQuantity)));
        summary.AppendChild(LabelRow("Hmotnost", Kilograms(model.TotalWeight)));
        AppendTable(body, summary);

        body.AppendChild(SectionHeading("Zastávky"));

        var stops = BuildTable(StopColumns);
        stops.AppendChild(HeaderRow("Zastávka", "Klient", "Město", "Kusů"));

        foreach (var stop in model.Stops)
        {
            stops.AppendChild(DataRow(
                Number(stop.Order),
                stop.ClientName ?? stop.Label ?? Missing,
                stop.City ?? Missing,
                // A custom stop delivers nothing, so a 0 here would read as a wasted trip. The
                // warehouse does hand goods over — its own stock purchases — and reports them.
                // Bare number: this column's own header is "Kusů".
                stop.ClientName is null && !stop.IsWarehouse ? Missing : Number(stop.TotalQuantity)));
        }

        AppendTable(body, stops);

        // Only when no warehouse stop lists them already — see the workbook writer for why the two
        // are not printed side by side, and why the block survives for a run with no such stop.
        if (model.StockPurchases.Count == 0 || model.HasWarehouseStop)
            return;

        body.AppendChild(SectionHeading("Zboží na sklad"));
        WriteProductTable(body, model.StockPurchases);
    }

    /// <summary>
    /// Where one party's goods went, what the order said, and what comes back — the parts the
    /// per-stop pages used to carry.
    /// </summary>
    /// <remarks>
    /// Nothing at all for a party with no delivery on this run, and no empty rows for the parts it
    /// has none of: a blank "Poznámky" reads as "no instructions", which is a claim this page has no
    /// business making.
    /// </remarks>
    private static void WritePartyNotes(Body body, ShipmentExportInvoiceParty party)
    {
        if (party.Notes.Count == 0)
            return;

        var details = LabelTable();

        // Nothing at all rather than an empty row: a blank "Poznámky" reads as "no instructions",
        // which is a claim this page has no business making.
        for (var i = 0; i < party.Notes.Count; i++)
            details.AppendChild(LabelRow(i == 0 ? "Poznámky" : string.Empty, party.Notes[i]));

        AppendTable(body, details);
    }

    private static void WritePartyDelivery(Body body, ShipmentExportInvoiceParty party)
    {
        var details = LabelTable();
        var any = false;

        if (party.Street is not null)
        {
            details.AppendChild(LabelRow("Ulice", party.Street));
            any = true;
        }

        if (party.CityLine is not null)
        {
            details.AppendChild(LabelRow("PSČ a město", party.CityLine));
            any = true;
        }

        if (party.DeliveryPlaceName is not null)
        {
            details.AppendChild(LabelRow("Místo dodání", party.DeliveryPlaceName));
            any = true;
        }

        for (var i = 0; i < party.Notes.Count; i++)
        {
            details.AppendChild(LabelRow(i == 0 ? "Poznámky" : string.Empty, party.Notes[i]));
            any = true;
        }

        if (!any)
            return;

        // Headed, unlike before: a bare pair of address rows under a client's name never said what
        // the address was for.
        body.AppendChild(SectionHeading("Fakturační adresa"));
        AppendTable(body, details);
    }

    /// <summary>
    /// The vratky one party hands back, below its products — what the client hands back reads after
    /// what is delivered.
    /// </summary>
    private static void WriteReturnsTable(Body body, List<ShipmentExportReturn> items)
    {
        body.AppendChild(SectionHeading("Vrací"));

        // Most vratky carry no note at all, and an always-present empty column reads as information
        // that failed to load. The column appears only once something is in it.
        var anyNotes = items.Any(item => !string.IsNullOrWhiteSpace(item.Note));

        var returns = BuildTable(anyNotes ? ReturnColumns : ReturnColumnsWithoutNotes);
        returns.AppendChild(anyNotes
            ? HeaderRow("Položka", "Poznámka", "Množství")
            : HeaderRow("Položka", "Množství"));

        foreach (var item in items)
        {
            returns.AppendChild(anyNotes
                ? DataRow(item.Name, item.Note ?? string.Empty, Pieces(item.Quantity))
                : DataRow(item.Name, Pieces(item.Quantity)));
        }

        AppendTable(body, returns);
    }

    /// <summary>
    /// The run's invoice split, one page per invoice: its parties' goods as a table each, with a
    /// subtotal, and the payer's total under them.
    /// </summary>
    /// <remarks>
    /// A document cannot collapse, so the subtotals carry the structure the workbook's row
    /// grouping does. Each invoice starts a fresh page for the same reason a stop does: this is
    /// handed over per client. The heading (and its sequence suffix) comes from
    /// <see cref="ShipmentExportLabels.InvoiceHeading"/>, shared with <see cref="ShipmentExportWorkbookBuilder"/>
    /// so the two exports of the same run cannot disagree about which headings need it.
    /// </remarks>
    private static void WriteInvoicePages(Body body, ShipmentExportModel model)
    {
        if (model.Invoices.Count == 0)
            return;

        var invoiceCountByClient = ShipmentExportLabels.InvoiceCountByPayer(model.Invoices);

        foreach (var invoice in model.Invoices)
        {
            body.AppendChild(PageBreak());

            // The heading names the row's number, its client and the client's business — the file is
            // read and filed by those. "Fakturace:" led it once and said nothing: every page here is
            // invoicing.
            body.AppendChild(Heading(ShipmentExportLabels.InvoiceHeading(invoice, invoiceCountByClient)));

            // An invoice billing several clients' goods is read top down — who it is addressed to,
            // what it bills in total, whom to invoice on, and only then the detail behind each
            // number. One that bills a single client needs none of that scaffolding: the client is
            // the heading, and its table is the whole invoice.
            if (invoice.Parties.Count > 1)
                WriteGroupInvoice(body, invoice);
            else
                WriteSingleClientInvoice(body, invoice);
        }
    }

    /// <summary>
    /// A payer's invoice: its own address, everything it bills as one table, the sub-clients to
    /// invoice on, then a numbered section per client.
    /// </summary>
    private static void WriteGroupInvoice(Body body, ShipmentExportInvoice invoice)
    {
        WriteInvoiceAddress(body, invoice);

        // The summary is what the payer owes, in one place. Its own closing row is the invoice's
        // total, so no paragraph restates it.
        WriteProductTable(body, invoice.AggregatedProducts);

        WriteBillingRecipients(body, invoice);

        var index = 1;

        foreach (var party in invoice.Parties)
        {
            // "4.1", "4.2" — the invoice's own number, then the client's place within it, so a
            // section can be named out loud against the number on the paper invoice.
            body.AppendChild(SectionHeading($"{invoice.Number}.{index++} {ShipmentExportLabels.PartyHeading(party)}"));

            // No address here: the invoice has one, at the top. What the client's own order said and
            // what it hands back are its alone, though, and belong beside its goods.
            WritePartyNotes(body, party);
            WriteProductTable(body, party.Products);

            if (party.Returns.Count > 0)
                WriteReturnsTable(body, party.Returns);
        }
    }

    /// <summary>
    /// An ordinary invoice: one client, its delivery, its goods, what it hands back.
    /// </summary>
    private static void WriteSingleClientInvoice(Body body, ShipmentExportInvoice invoice)
    {
        foreach (var party in invoice.Parties)
        {
            WritePartyDelivery(body, party);
            WriteProductTable(body, party.Products);

            if (party.Returns.Count > 0)
                WriteReturnsTable(body, party.Returns);
        }

        WriteBillingRecipients(body, invoice);
    }

    /// <summary>
    /// The address the invoice is sent to. Nothing at all when the payer has none on file.
    /// </summary>
    private static void WriteInvoiceAddress(Body body, ShipmentExportInvoice invoice)
    {
        if (invoice.PayerStreet is null && invoice.PayerCityLine is null)
            return;

        body.AppendChild(SectionHeading("Fakturační adresa"));

        var details = LabelTable();

        if (invoice.PayerStreet is not null)
            details.AppendChild(LabelRow("Ulice", invoice.PayerStreet));

        if (invoice.PayerCityLine is not null)
            details.AppendChild(LabelRow("PSČ a město", invoice.PayerCityLine));

        AppendTable(body, details);
    }

    /// <summary>
    /// Placed with this invoice's page rather than after the loop, so it reads as part of this
    /// payer's invoice rather than as a stray section at the end of the document.
    /// </summary>
    private static void WriteBillingRecipients(Body body, ShipmentExportInvoice invoice)
    {
        if (invoice.BillingRecipients.Count == 0)
            return;

        body.AppendChild(SectionHeading(ShipmentExportLabels.BillingRecipientsHeading(invoice)));
        WriteBillingRecipientsTable(body, invoice.BillingRecipients);
    }

    /// <summary>
    /// The sub-clients named on an invoice, with the address recorded for the payer to invoice.
    /// </summary>
    /// <remarks>
    /// Routed through <see cref="AppendTable"/> like every other table here, which is what keeps it
    /// from ever landing directly against the next invoice's page-break paragraph or another table.
    /// </remarks>
    private static void WriteBillingRecipientsTable(Body body, List<ShipmentExportBillingRecipient> recipients)
    {
        var table = BuildTable(BillingRecipientColumns);
        table.AppendChild(HeaderRow("Klient", "Adresa"));

        foreach (var recipient in recipients)
            table.AppendChild(DataRow(recipient.ClientName, recipient.AddressLine));

        AppendTable(body, table);
    }

    /// <summary>
    /// A product table, reporting what the van drops beside what the invoice bills wherever the rows
    /// can answer for both.
    /// </summary>
    /// <remarks>
    /// Derived from the rows rather than passed in: the run's own stock purchases are billed to
    /// nobody, and a supplier good is collected at the supplier and sits on no delivery table, so
    /// both keep the single quantity column. A column of nothing but dashes reads as data that
    /// failed to load.
    /// </remarks>
    private static void WriteProductTable(Body body, List<ShipmentExportProduct> products)
    {
        if (products.Count == 0)
        {
            body.AppendChild(Paragraph("Bez položek", italic: true));
            return;
        }

        var withDelivered = products.Any(p => p.DeliveredQuantity is not null);

        var table = BuildTable(withDelivered ? ProductColumnsWithDelivered : ProductColumns);
        table.AppendChild(withDelivered
            ? HeaderRow("Produkt", "Druh", "Balení", "Skutečně", "Fakturačně")
            : HeaderRow("Produkt", "Druh", "Balení", "Množství"));

        foreach (var product in products)
        {
            string[] cells =
            [
                product.Name,
                KindLabel(product.Kind),
                Litres(product.PackageSize)
            ];

            table.AppendChild(withDelivered
                // A dash where no stop can answer for the row, which reads as "not applicable"
                // rather than as "delivered nothing".
                ? DataRow([
                    .. cells,
                    product.DeliveredQuantity is null ? Missing : Pieces(product.DeliveredQuantity.Value),
                    Pieces(product.Quantity)
                ])
                : DataRow([.. cells, Pieces(product.Quantity)]));
        }

        table.AppendChild(withDelivered
            ? TotalRow(
                "Celkem",
                Pieces(products.Sum(p => p.DeliveredQuantity ?? 0)),
                Pieces(products.Sum(p => p.Quantity)))
            : TotalRow("Celkem", Pieces(products.Sum(p => p.Quantity))));

        AppendTable(body, table);
    }

    /// <summary>
    /// Appends a table followed by an empty paragraph.
    /// </summary>
    /// <remarks>
    /// The trailing paragraph is not decoration. Word merges two tables that sit directly against
    /// each other into one — which is what ran a client's address block into their product table —
    /// and a body whose last element is a table is a shape Word repairs rather than opens. Routing
    /// every table through here makes both impossible to reintroduce by adding a section later.
    /// </remarks>
    private static void AppendTable(Body body, Table table)
    {
        body.AppendChild(table);
        body.AppendChild(new Paragraph(new ParagraphProperties(
            new SpacingBetweenLines { After = "0", Line = "120", LineRule = LineSpacingRuleValues.Auto })));
    }

    private static Paragraph Heading(string text) =>
        new(
            new ParagraphProperties(new SpacingBetweenLines { After = "160" }),
            Run(text, bold: true, fontSize: HeadingFontSize));

    /// <summary>
    /// A hard page break — what Ctrl+Enter inserts.
    /// </summary>
    /// <remarks>
    /// An explicit break run rather than <c>pageBreakBefore</c> on the following heading. The latter
    /// is a paragraph *hint*, and readers outside Word routinely ignore it, which left every client
    /// running onto the previous client's page — the one thing a per-stop handover sheet cannot do.
    ///
    /// The two mechanisms must never be combined: a reader honouring both breaks twice and leaves a
    /// blank page between every client.
    /// </remarks>
    private static Paragraph PageBreak() =>
        new(new Run(new Break { Type = BreakValues.Page }));

    private static Paragraph SectionHeading(string text) =>
        new(
            new ParagraphProperties(new SpacingBetweenLines { Before = "240", After = "80" }),
            Run(text.ToUpperInvariant(), bold: true));

    private static Paragraph Paragraph(string text, bool italic = false) =>
        new(Run(text, italic: italic));

    private static Run Run(string text, bool bold = false, bool italic = false, string? fontSize = null)
    {
        // Bold and italic before the size: rPr's children are a fixed sequence (b, i, … sz), and
        // Word refuses a document that orders them any other way.
        var properties = new RunProperties();

        if (bold)
            properties.AppendChild(new Bold());

        if (italic)
            properties.AppendChild(new Italic());

        properties.AppendChild(new FontSize { Val = fontSize ?? BodyFontSize });

        // Space preserved because notes and product names can begin or end on one, and Word would
        // otherwise collapse it away.
        return new Run(properties, new Text(text) { Space = SpaceProcessingModeValues.Preserve });
    }

    /// <summary>
    /// Borderless two-column table for label/value blocks — a layout grid, not a data table.
    /// </summary>
    private static Table LabelTable() => BuildTable(LabelColumns, bordered: false);

    private static Table BuildTable(int[] columnWidths, bool bordered = true)
    {
        // tblPr's children are a fixed sequence too: width, then borders, then layout.
        var properties = new TableProperties(
            new TableWidth { Width = columnWidths.Sum().ToString(), Type = TableWidthUnitValues.Dxa });

        if (bordered)
        {
            // Ordered top, left, bottom, right, inside-h, inside-v — again the schema's sequence,
            // not the CSS one.
            properties.AppendChild(new TableBorders(
                new TopBorder { Val = BorderValues.Single, Size = 4 },
                new LeftBorder { Val = BorderValues.Single, Size = 4 },
                new BottomBorder { Val = BorderValues.Single, Size = 4 },
                new RightBorder { Val = BorderValues.Single, Size = 4 },
                new InsideHorizontalBorder { Val = BorderValues.Single, Size = 4 },
                new InsideVerticalBorder { Val = BorderValues.Single, Size = 4 }));
        }

        properties.AppendChild(new TableLayout { Type = TableLayoutValues.Fixed });

        // Cell padding, after the layout per the schema's sequence. Without it text sits hard against
        // the cell border, which is legible on screen and cramped on paper.
        properties.AppendChild(new TableCellMarginDefault(
            new TopMargin { Width = "40", Type = TableWidthUnitValues.Dxa },
            new TableCellLeftMargin { Width = 108, Type = TableWidthValues.Dxa },
            new BottomMargin { Width = "40", Type = TableWidthUnitValues.Dxa },
            new TableCellRightMargin { Width = 108, Type = TableWidthValues.Dxa }));

        var grid = new TableGrid(columnWidths.Select(width =>
            (OpenXmlElement)new GridColumn { Width = width.ToString() }));

        return new Table(properties, grid);
    }

    private static TableRow LabelRow(string label, string value) =>
        Row(Cell(label, bold: true), Cell(value));

    /// <summary>
    /// Column headings — shaded, and repeated at the top of every page the table runs onto.
    /// </summary>
    /// <remarks>
    /// A long order spills past one page, and a column of bare quantities with no heading above it is
    /// exactly the kind of thing that gets read into the wrong row.
    /// </remarks>
    private static TableRow HeaderRow(params string[] headers)
    {
        var row = Row(headers
            .Select(header => Cell(header.ToUpperInvariant(), bold: true, shaded: true))
            .ToArray());

        row.TableRowProperties!.AppendChild(new TableHeader());
        return row;
    }

    private static TableRow DataRow(params string[] values) =>
        Row(values.Select(value => Cell(value)).ToArray());

    /// <summary>
    /// Closing total, with the columns that carry no total merged rather than left blank — an empty
    /// bordered cell reads as a value that failed to arrive.
    /// </summary>
    /// <remarks>
    /// Takes one total per trailing column. The merged span is two either way — the kind and the
    /// package are the columns with nothing to total, in both the four-column shape and the
    /// five-column one that adds a billed total beside the delivered one.
    /// </remarks>
    private static TableRow TotalRow(string label, params string[] totals) =>
        Row([
            Cell(label, bold: true),
            Cell(string.Empty, gridSpan: 2),
            .. totals.Select(total => Cell(total, bold: true))
        ]);

    /// <summary>
    /// A row that will not be split across a page boundary.
    /// </summary>
    /// <remarks>
    /// trPr's children are a fixed sequence, so cantSplit goes in before anything HeaderRow adds.
    /// </remarks>
    private static TableRow Row(params TableCell[] cells)
    {
        var row = new TableRow(new TableRowProperties(new CantSplit()));

        foreach (var cell in cells)
            row.AppendChild(cell);

        return row;
    }

    /// <remarks>
    /// tcPr's children are a fixed sequence: the span before the shading.
    /// </remarks>
    private static TableCell Cell(string text, bool bold = false, bool shaded = false, int gridSpan = 1)
    {
        var properties = new TableCellProperties();

        if (gridSpan > 1)
            properties.AppendChild(new GridSpan { Val = gridSpan });

        if (shaded)
            properties.AppendChild(new Shading
            {
                Val = ShadingPatternValues.Clear, Color = "auto", Fill = HeaderFill
            });

        return new TableCell(properties, new Paragraph(Run(text, bold: bold)));
    }
}
