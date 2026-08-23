using ClosedXML.Excel;
using static AleTrack.Features.OutgoingShipments.Queries.Export.ShipmentExportLabels;

namespace AleTrack.Features.OutgoingShipments.Queries.Export;

/// <summary>
/// Writes a <see cref="ShipmentExportModel"/> out as an .xlsx workbook: an overview sheet for the
/// run, then one sheet holding its confirmed invoice rows.
/// </summary>
/// <remarks>
/// The Czech text comes from <see cref="ShipmentExportLabels"/>, shared with the document writer.
///
/// Unlike that writer, this one puts real numbers and dates in cells rather than formatted strings,
/// and applies a number *format* instead. A spreadsheet is worked in — the office sums a column and
/// sorts by a date — and Excel substitutes the reader's own separators into the format, so a cell
/// holding text would break both.
/// </remarks>
public static class ShipmentExportWorkbookBuilder
{
    /// <summary>Name of the sheet carrying the run's own summary.</summary>
    public const string OverviewSheetName = "Přehled";

    /// <summary>Name of the sheet carrying the run's invoice split.</summary>
    public const string InvoiceSheetName = Invoicing;

    /// <summary>Piece counts, grouped so a four-figure run does not read as one number.</summary>
    private const string QuantityFormat = "#,##0";

    private const string WeightFormat = "#,##0.0";

    // Package size deliberately carries no format. It renders as 0,5 and 30 on General, and every
    // explicit decimal format either pads whole sizes with zeros or leaves a trailing separator.

    /// <summary>
    /// Builds the workbook and returns its bytes.
    /// </summary>
    public static byte[] Build(ShipmentExportModel model)
    {
        using var workbook = new XLWorkbook();

        WriteOverviewSheet(workbook, model);
        WriteInvoiceSheet(workbook, model);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static void WriteOverviewSheet(XLWorkbook workbook, ShipmentExportModel model)
    {
        var sheet = workbook.AddWorksheet(OverviewSheetName);

        // Column 1 also carries the stock block's product names, which are the longest text on this
        // sheet — at 22 "Svijanský Vozka yuzu & bergamot" was cut off mid-word.
        sheet.Column(1).Width = 34;
        sheet.Column(2).Width = 30;
        sheet.Column(3).Width = 22;
        sheet.Column(4).Width = 16;

        var row = 1;

        WriteLabel(sheet, row++, "Vývoz", model.ShipmentName);
        WriteDateLabel(sheet, row++, "Datum dodání", model.DeliveryDate);
        WriteLabel(sheet, row++, "Vozidlo", model.VehicleName ?? Missing);
        // Singular when one drives, so a one-driver run does not read as a list of one.
        WriteLabel(
            sheet,
            row++,
            model.DriverNames.Count == 1 ? "Řidič" : "Řidiči",
            model.DriverNames.Count > 0 ? string.Join(", ", model.DriverNames) : Missing);

        row++;

        WriteNumberLabel(sheet, row++, "Zastávek", model.Stops.Count, QuantityFormat);
        WriteNumberLabel(sheet, row++, "Klientů", model.ClientStops.Count(), QuantityFormat);
        WriteNumberLabel(sheet, row++, "Celkem kusů", model.TotalQuantity, QuantityFormat);
        WriteNumberLabel(sheet, row++, "Hmotnost (kg)", model.TotalWeight, WeightFormat);

        row++;

        row = WriteStopTable(sheet, row, model);

        // Only when no warehouse stop counts them already: the route table above reports that
        // stop's pieces, which are exactly these, and printing the same goods twice invites the two
        // to be read as two deliveries. The block stays for a run that carries stock goods without
        // calling at the warehouse — better an odd-looking block than goods that appear nowhere.
        if (model.StockPurchases.Count > 0 && !model.HasWarehouseStop)
        {
            row++;
            WriteSectionHeading(sheet, row++, "Zboží na sklad");
            WriteProductTable(sheet, ref row, model.StockPurchases, withTotal: true);
        }
    }

    /// <summary>
    /// The run's stops, custom ones included — the driver's page, and the only place a stop whose
    /// row nobody has confirmed appears at all.
    /// </summary>
    private static int WriteStopTable(IXLWorksheet sheet, int row, ShipmentExportModel model)
    {
        WriteTableHeader(sheet, row++, "Zastávka", "Klient", "Město", "Kusů");

        foreach (var stop in model.Stops)
        {
            // Left-aligned, unlike every other number here: right-aligned in a 34-wide column it sat
            // a screen away from the client name it belongs to.
            sheet.Cell(row, 1).Value = stop.Order;
            sheet.Cell(row, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;

            sheet.Cell(row, 2).Value = stop.ClientName ?? stop.Label ?? Missing;
            sheet.Cell(row, 3).Value = stop.City ?? Missing;

            if (stop.ClientName is null && !stop.IsWarehouse)
            {
                // A custom stop delivers nothing, so a 0 here would read as a wasted trip. The
                // warehouse does hand goods over — its own stock purchases — and reports them.
                sheet.Cell(row, 4).Value = Missing;
            }
            else
            {
                sheet.Cell(row, 4).Value = stop.TotalQuantity;
                sheet.Cell(row, 4).Style.NumberFormat.Format = QuantityFormat;
            }

            row++;
        }

        return row;
    }

    /// <summary>
    /// The run's invoice split: a heading per invoice, then its parties' goods with a subtotal
    /// each and the invoice's total.
    /// </summary>
    /// <remarks>
    /// One block per <see cref="ShipmentExportInvoice"/> — a client holding two invoices on the
    /// run produces two blocks, so the heading names the invoice's sequence whenever that client
    /// holds more than one, mirroring the Fakturace screen's own "Faktura N" rule, and omits it
    /// otherwise so a client with a single invoice is not saddled with a meaningless "1".
    ///
    /// The parties' product rows are grouped so the sheet's outline lets the office collapse a
    /// party down to its subtotal — the totals are read first and the detail only when a number
    /// looks wrong. ClosedXML's row grouping does not preserve <c>IsHidden</c> through a
    /// save/reload round-trip in this version, so the sheet opens with every row expanded rather
    /// than pre-collapsed; the outline itself still round-trips and the office can collapse it by
    /// hand.
    ///
    /// Omitted entirely for a run with nothing to show — no split at all, or nothing confirmed
    /// yet: an empty sheet reads as data that failed to load rather than as "nothing finished".
    /// </remarks>
    private static void WriteInvoiceSheet(XLWorkbook workbook, ShipmentExportModel model)
    {
        if (model.Invoices.Count == 0)
            return;

        // Only a client holding more than one invoice on the run needs its blocks told apart.
        var invoiceCountByClient = ShipmentExportLabels.InvoiceCountByPayer(model.Invoices);

        var sheet = workbook.Worksheets.Add(InvoiceSheetName);
        var row = 1;

        foreach (var invoice in model.Invoices)
        {
            var heading = ShipmentExportLabels.InvoiceHeading(invoice, invoiceCountByClient);

            sheet.Cell(row, 1).Value = heading;
            sheet.Cell(row, 1).Style.Font.Bold = true;
            sheet.Cell(row, 1).Style.Fill.BackgroundColor = XLColor.FromArgb(0xF2, 0xF2, 0xF2);
            row++;

            foreach (var party in invoice.Parties)
            {
                sheet.Cell(row, 1).Value = ShipmentExportLabels.PartyHeading(party);
                sheet.Cell(row, 1).Style.Font.Italic = true;
                sheet.Cell(row, 4).Value = party.TotalQuantity;
                sheet.Cell(row, 4).Style.NumberFormat.Format = QuantityFormat;
                sheet.Cell(row, 4).Style.Font.Bold = true;
                row++;

                var first = row;
                WritePartyDelivery(sheet, ref row, party);
                WriteProductTable(sheet, ref row, party.Products, withTotal: false);

                if (party.Returns.Count > 0)
                    WriteReturnsTable(sheet, ref row, party.Returns);

                if (row > first)
                    sheet.Rows(first, row - 1).Group();
            }

            sheet.Cell(row, 1).Value = "Celkem";
            sheet.Cell(row, 1).Style.Font.Bold = true;
            sheet.Cell(row, 1).Style.Border.TopBorder = XLBorderStyleValues.Thin;
            WriteTotalCell(sheet, row, 4, invoice.TotalQuantity);
            row += 2;

            if (invoice.BillingRecipients.Count > 0)
                row = WriteBillingRecipients(sheet, row, invoice);
        }

        sheet.Columns().AdjustToContents();
    }

    /// <summary>
    /// The sub-clients named on this invoice, with the address recorded for the payer to invoice —
    /// placed right after the invoice's own block, not as a stray appendix at the foot of the sheet.
    /// </summary>
    private static int WriteBillingRecipients(IXLWorksheet sheet, int row, ShipmentExportInvoice invoice)
    {
        WriteSectionHeading(sheet, row++, ShipmentExportLabels.BillingRecipientsHeading(invoice));

        foreach (var recipient in invoice.BillingRecipients)
        {
            sheet.Cell(row, 1).Value = recipient.ClientName;
            sheet.Cell(row, 2).Value = recipient.AddressLine;
            row++;
        }

        return row + 1;
    }

    /// <summary>
    /// Where one party's goods went, and what the order behind them said.
    /// </summary>
    /// <remarks>
    /// Nothing at all for a party with no delivery on this run, and no empty rows for the parts it
    /// has none of: a blank "Poznámky" reads as "no instructions", which is a claim this file has no
    /// business making.
    /// </remarks>
    private static void WritePartyDelivery(IXLWorksheet sheet, ref int row, ShipmentExportInvoiceParty party)
    {
        if (party.AddressLine.Length > 0)
            WriteLabel(sheet, row++, "Adresa", party.AddressLine);

        if (party.DeliveryPlaceName is not null)
            WriteLabel(sheet, row++, "Místo dodání", party.DeliveryPlaceName);

        for (var i = 0; i < party.Notes.Count; i++)
            WriteLabel(sheet, row++, i == 0 ? "Poznámky" : string.Empty, party.Notes[i]);
    }

    /// <summary>
    /// The vratky one party hands back, under its product table.
    /// </summary>
    /// <remarks>
    /// Headed, and in its own contiguous columns rather than aligned with the product table's
    /// quantity: these pieces travel the other way and must never be read into the delivered total.
    /// </remarks>
    private static void WriteReturnsTable(IXLWorksheet sheet, ref int row, List<ShipmentExportReturn> returns)
    {
        row++;
        WriteSectionHeading(sheet, row++, "Vrací");

        // Most vratky carry no note at all, and an always-present empty column reads as information
        // that failed to load. The column appears only once something is in it.
        var anyNotes = returns.Any(item => !string.IsNullOrWhiteSpace(item.Note));
        var quantityColumn = anyNotes ? 3 : 2;

        WriteTableHeader(sheet, row++, anyNotes
            ? ["Položka", "Poznámka", "Množství (ks)"]
            : ["Položka", "Množství (ks)"]);

        foreach (var item in returns)
        {
            sheet.Cell(row, 1).Value = item.Name;

            if (anyNotes)
                sheet.Cell(row, 2).Value = item.Note ?? string.Empty;

            sheet.Cell(row, quantityColumn).Value = item.Quantity;
            sheet.Cell(row, quantityColumn).Style.NumberFormat.Format = QuantityFormat;
            row++;
        }
    }

    /// <summary>
    /// A product table: one row per item, optionally totalled.
    /// </summary>
    private static void WriteProductTable(
        IXLWorksheet sheet,
        ref int row,
        List<ShipmentExportProduct> products,
        bool withTotal)
    {
        WriteTableHeader(sheet, row++, "Produkt", "Druh", "Balení (l)", "Množství (ks)");

        if (products.Count == 0)
        {
            sheet.Cell(row, 1).Value = "Bez položek";
            sheet.Cell(row, 1).Style.Font.Italic = true;
            row++;
            return;
        }

        foreach (var product in products)
        {
            sheet.Cell(row, 1).Value = product.Name;
            sheet.Cell(row, 2).Value = KindLabel(product.Kind);

            if (product.PackageSize is not null)
                sheet.Cell(row, 3).Value = product.PackageSize.Value;
            else
                sheet.Cell(row, 3).Value = Missing;

            sheet.Cell(row, 4).Value = product.Quantity;
            sheet.Cell(row, 4).Style.NumberFormat.Format = QuantityFormat;

            row++;
        }

        if (!withTotal)
            return;

        sheet.Cell(row, 1).Value = "Celkem";
        sheet.Cell(row, 1).Style.Font.Bold = true;
        sheet.Cell(row, 1).Style.Border.TopBorder = XLBorderStyleValues.Thin;

        WriteTotalCell(sheet, row, 4, products.Sum(p => p.Quantity));

        row++;
    }

    private static void WriteTotalCell(IXLWorksheet sheet, int row, int column, int total)
    {
        sheet.Cell(row, column).Value = total;
        sheet.Cell(row, column).Style.Font.Bold = true;
        sheet.Cell(row, column).Style.NumberFormat.Format = QuantityFormat;
        sheet.Cell(row, column).Style.Border.TopBorder = XLBorderStyleValues.Thin;
    }

    /// <summary>
    /// One row of a label/value block.
    /// </summary>
    /// <remarks>
    /// The value is left-aligned even when it is a number or a date, which Excel would otherwise push
    /// to the far edge of a 30-wide column — a stride away from the label it answers. Alignment is a
    /// display choice here and does not stop the cell being a real number.
    /// </remarks>
    private static IXLCell WriteLabel(IXLWorksheet sheet, int row, string label, string? value = null)
    {
        sheet.Cell(row, 1).Value = label;
        sheet.Cell(row, 1).Style.Font.Bold = true;

        var cell = sheet.Cell(row, 2);
        cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;

        if (value is not null)
            cell.Value = value;

        return cell;
    }

    private static void WriteNumberLabel(IXLWorksheet sheet, int row, string label, double value, string format)
    {
        var cell = WriteLabel(sheet, row, label);
        cell.Value = value;
        cell.Style.NumberFormat.Format = format;
    }

    private static void WriteDateLabel(IXLWorksheet sheet, int row, string label, DateTime? value)
    {
        if (value is null)
        {
            WriteLabel(sheet, row, label, Missing);
            return;
        }

        // A real date cell rather than preformatted text, so the reader can sort and filter on it.
        // The format is pinned so it does not follow whatever locale opens the file.
        var cell = WriteLabel(sheet, row, label);
        cell.Value = value.Value.Date;
        cell.Style.DateFormat.Format = "d.M.yyyy";
    }

    private static void WriteSectionHeading(IXLWorksheet sheet, int row, string text)
    {
        var cell = sheet.Cell(row, 1);
        cell.Value = text.ToUpperInvariant();
        cell.Style.Font.Bold = true;
        cell.Style.Font.FontColor = XLColor.FromArgb(0x60, 0x60, 0x60);
    }

    /// <summary>
    /// A shaded heading band across as many columns as there are headers.
    /// </summary>
    /// <remarks>
    /// Every column gets shaded. An earlier version skipped blank headers so the returns table could
    /// leave a gap and line its quantity up with the products table's — which showed up as an
    /// unshaded hole in the middle of the band. Tables are laid out contiguously instead.
    /// </remarks>
    private static void WriteTableHeader(IXLWorksheet sheet, int row, params string[] headers)
    {
        for (var column = 0; column < headers.Length; column++)
        {
            var cell = sheet.Cell(row, column + 1);
            cell.Value = headers[column].ToUpperInvariant();
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromArgb(0xF2, 0xF2, 0xF2);
            cell.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
        }
    }
}
