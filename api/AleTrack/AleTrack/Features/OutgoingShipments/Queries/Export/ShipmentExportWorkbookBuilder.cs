using ClosedXML.Excel;
using static AleTrack.Features.OutgoingShipments.Queries.Export.ShipmentExportLabels;

namespace AleTrack.Features.OutgoingShipments.Queries.Export;

/// <summary>
/// Writes a <see cref="ShipmentExportModel"/> out as an .xlsx workbook: an overview sheet for the
/// run, then one sheet per client stop.
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

    /// <summary>Excel's hard limit on the length of a worksheet name.</summary>
    private const int MaxSheetNameLength = 31;

    /// <summary>
    /// Characters Excel forbids in a worksheet name.
    /// </summary>
    private static readonly char[] ForbiddenSheetNameChars = ['[', ']', ':', '*', '?', '/', '\\'];

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

        // Excel rejects a duplicate sheet name outright, and one client can hold two stops on a
        // route, so names are tracked as they are handed out rather than assumed unique.
        var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { OverviewSheetName };

        foreach (var stop in model.ClientStops)
            WriteStopSheet(workbook, stop, usedNames);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    /// <summary>
    /// Worksheet name for a client stop — <c>1. Hospoda U Kotvy</c>, cut to what Excel accepts and
    /// suffixed when a client holds more than one stop under a name that truncates to the same
    /// thing.
    /// </summary>
    public static string SheetNameFor(ShipmentExportStop stop, ISet<string> usedNames)
    {
        // Replaced with a space rather than dropped: deleting the slash out of "pivo/pivo" would run
        // the two words together, which reads as a different name than the client has. Whitespace
        // runs then collapse, so a stripped character leaves no double space behind.
        var sanitized = new string((stop.ClientName ?? Missing)
            .Select(c => ForbiddenSheetNameChars.Contains(c) ? ' ' : c)
            .ToArray());

        var cleaned = string.Join(' ', sanitized.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

        if (cleaned.Length == 0)
            cleaned = Missing;

        var candidate = Truncate($"{stop.Order}. {cleaned}", MaxSheetNameLength);

        if (usedNames.Add(candidate))
            return candidate;

        // Truncation is what makes a collision possible at all once the stop number is in the name,
        // so the suffix has to displace characters rather than be appended past the limit.
        for (var attempt = 2; ; attempt++)
        {
            var suffix = $" ({attempt})";
            var suffixed = Truncate(candidate, MaxSheetNameLength - suffix.Length) + suffix;

            if (usedNames.Add(suffixed))
                return suffixed;
        }
    }

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength].TrimEnd();

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

        if (model.StockPurchases.Count > 0)
        {
            row++;
            WriteSectionHeading(sheet, row++, "Zboží na sklad");
            WriteProductTable(sheet, ref row, model.StockPurchases, withTotal: true);
        }
    }

    /// <summary>
    /// The run's stops, custom ones included — the only place they appear, since a stop with no
    /// order has no goods to give a sheet of its own.
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

            if (stop.ClientName is null)
            {
                // A custom stop delivers nothing, so a 0 here would read as a wasted trip.
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

    private static void WriteStopSheet(XLWorkbook workbook, ShipmentExportStop stop, ISet<string> usedNames)
    {
        var sheet = workbook.AddWorksheet(SheetNameFor(stop, usedNames));

        sheet.Column(1).Width = 34;
        sheet.Column(2).Width = 16;
        sheet.Column(3).Width = 14;
        sheet.Column(4).Width = 16;

        var row = 1;

        WriteLabel(sheet, row++, "Klient", stop.ClientName ?? Missing);
        WriteLabel(sheet, row++, "Ulice", stop.Street ?? Missing);
        WriteLabel(sheet, row++, "PSČ a město", stop.CityLine ?? Missing);

        if (stop.DeliveryPlaceName is not null)
            WriteLabel(sheet, row++, "Místo dodání", stop.DeliveryPlaceName);

        // Nothing at all rather than an empty row: a blank "Poznámky" reads as "no instructions",
        // which is a claim this sheet has no business making.
        for (var i = 0; i < stop.Notes.Count; i++)
            WriteLabel(sheet, row++, i == 0 ? "Poznámky" : string.Empty, stop.Notes[i]);

        row++;

        var productsHeaderRow = row;
        WriteProductTable(sheet, ref row, stop.Products, withTotal: true);

        // Long orders scroll past the header otherwise, and a quantity column with no header above
        // it is exactly the kind of thing that gets read into the wrong row.
        sheet.SheetView.FreezeRows(productsHeaderRow);

        if (stop.Returns.Count == 0)
            return;

        row++;
        WriteSectionHeading(sheet, row++, "Vrací");

        // Most vratky carry no note at all, and an always-present empty column reads as information
        // that failed to load. The column appears only once something is in it.
        var anyNotes = stop.Returns.Any(item => !string.IsNullOrWhiteSpace(item.Note));

        // Contiguous columns, so the quantity does not line up with the products table's. It only
        // looks like the same column: these pieces travel the other way and must never be summed
        // into the delivered total. The previous layout skipped a column to align them, which left an
        // unshaded hole in the middle of the header band.
        var quantityColumn = anyNotes ? 3 : 2;

        WriteTableHeader(sheet, row++, anyNotes
            ? ["Položka", "Poznámka", "Množství (ks)"]
            : ["Položka", "Množství (ks)"]);

        foreach (var item in stop.Returns)
        {
            sheet.Cell(row, 1).Value = item.Name;

            if (anyNotes)
                sheet.Cell(row, 2).Value = item.Note ?? string.Empty;

            sheet.Cell(row, quantityColumn).Value = item.Quantity;
            sheet.Cell(row, quantityColumn).Style.NumberFormat.Format = QuantityFormat;
            row++;
        }
    }

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
        sheet.Cell(row, 4).Value = products.Sum(p => p.Quantity);
        sheet.Cell(row, 4).Style.Font.Bold = true;
        sheet.Cell(row, 4).Style.NumberFormat.Format = QuantityFormat;
        sheet.Cell(row, 4).Style.Border.TopBorder = XLBorderStyleValues.Thin;
        sheet.Cell(row, 1).Style.Border.TopBorder = XLBorderStyleValues.Thin;
        row++;
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
