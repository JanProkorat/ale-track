using System.Globalization;
using AleTrack.Common.Enums;

namespace AleTrack.Features.Products.Import;

/// <summary>
/// Reads a brewery price list in the catalogue's CSV shape.
/// </summary>
/// <remarks>
/// Deliberately not a PDF reader. The published lists are multi-column typesetting exports whose
/// bottle and keg rows interleave; extracting them in the application would be brittle and would
/// fail silently on a layout change, which for price data is the worst available failure mode. A PDF
/// is transcribed once into this format, and this format is what both the seeded files and an
/// uploaded list are read from.
///
/// Rows are validated independently and every failure is collected, because an import preview that
/// surfaces one problem per attempt is nearly useless.
/// </remarks>
public static class PriceListCatalogParser
{
    /// <summary>VAT rate the lists state ("DPH 21%"). A future rate is a new constant, not a reinterpretation of old files.</summary>
    private const decimal VatRate = 1.21m;

    /// <summary>Mirrors the length <see cref="Entities.Product.Name"/> is stored at.</summary>
    private const int MaxNameLength = 50;

    private static readonly string[] RequiredColumns =
    [
        "name", "type", "alcohol", "plato", "container", "volume_l", "sale_unit", "units",
        "unit_novat", "unit_vat", "pack_novat", "pack_vat"
    ];

    /// <summary>
    /// Parses <paramref name="content"/> into a catalogue, or into the reasons it is not one.
    /// </summary>
    public static PriceListParseResult Parse(string content)
    {
        var errors = new List<PriceListParseError>();
        string? brewery = null;
        DateOnly? effectiveFrom = null;
        string? source = null;

        Dictionary<string, int>? columns = null;
        var rows = new List<PriceListRow>();
        var seen = new Dictionary<string, int>();

        var lines = content.Replace("\r\n", "\n").Split('\n');

        for (var index = 0; index < lines.Length; index++)
        {
            var lineNumber = index + 1;
            var line = lines[index].Trim();

            if (line.Length == 0)
            {
                continue;
            }

            if (line.StartsWith('#'))
            {
                ReadMetadata(line, lineNumber, errors, ref brewery, ref effectiveFrom, ref source);
                continue;
            }

            if (columns is null)
            {
                columns = ReadHeader(line, lineNumber, errors);
                continue;
            }

            var row = ReadRow(line, lineNumber, columns, errors);
            if (row is null)
            {
                continue;
            }

            var key = NaturalKey(row);
            if (seen.TryGetValue(key, out var firstLine))
            {
                errors.Add(new PriceListParseError(lineNumber, PriceListErrorCodes.DuplicateRow,
                    $"'{row.Name}' in this packaging is already on line {firstLine}."));
                continue;
            }

            seen[key] = lineNumber;
            rows.Add(row);
        }

        if (columns is null)
        {
            errors.Add(new PriceListParseError(null, PriceListErrorCodes.MissingHeader,
                "The file has no header row."));
        }
        else if (rows.Count == 0 && errors.Count == 0)
        {
            errors.Add(new PriceListParseError(null, PriceListErrorCodes.NoRows,
                "The file has a header but no products."));
        }

        return errors.Count > 0
            ? new PriceListParseResult(null, errors)
            : new PriceListParseResult(new PriceListCatalog(brewery, effectiveFrom, source, rows), errors);
    }

    private static void ReadMetadata(
        string line, int lineNumber, List<PriceListParseError> errors,
        ref string? brewery, ref DateOnly? effectiveFrom, ref string? source)
    {
        // "# brewery: Svijany". A comment without a recognised key is just a comment.
        var body = line.TrimStart('#').Trim();
        var separator = body.IndexOf(':');
        if (separator <= 0)
        {
            return;
        }

        var key = body[..separator].Trim().ToLowerInvariant();
        var value = body[(separator + 1)..].Trim();

        switch (key)
        {
            case "brewery":
                brewery = value;
                break;
            case "source":
                source = value;
                break;
            case "effective_from":
                if (DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                        DateTimeStyles.None, out var parsed))
                {
                    effectiveFrom = parsed;
                }
                else
                {
                    errors.Add(new PriceListParseError(lineNumber, PriceListErrorCodes.InvalidDate,
                        $"'{value}' is not a date in yyyy-MM-dd form."));
                }

                break;
        }
    }

    private static Dictionary<string, int>? ReadHeader(
        string line, int lineNumber, List<PriceListParseError> errors)
    {
        var columns = line.Split(',')
            .Select((name, position) => (Name: name.Trim().ToLowerInvariant(), position))
            .ToDictionary(x => x.Name, x => x.position);

        var missing = RequiredColumns.Where(c => !columns.ContainsKey(c)).ToList();
        if (missing.Count > 0)
        {
            errors.Add(new PriceListParseError(lineNumber, PriceListErrorCodes.MissingColumn,
                $"The header is missing: {string.Join(", ", missing)}."));
        }

        return columns;
    }

    private static PriceListRow? ReadRow(
        string line, int lineNumber, Dictionary<string, int> columns, List<PriceListParseError> errors)
    {
        var cells = line.Split(',');
        var failures = errors.Count;

        var publicId = ReadGuid(cells, columns, "public_id", lineNumber, errors);

        var name = Cell(cells, columns, "name");
        if (string.IsNullOrWhiteSpace(name))
        {
            errors.Add(new PriceListParseError(lineNumber, PriceListErrorCodes.MissingValue,
                "The product has no name."));
        }
        else if (name.Trim().Length > MaxNameLength)
        {
            // Caught here rather than at the database, where it would surface as a 500 partway
            // through an import that had already reported itself as previewable.
            errors.Add(new PriceListParseError(lineNumber, PriceListErrorCodes.NameTooLong,
                $"'{name.Trim()}' is longer than {MaxNameLength} characters."));
        }

        var type = ReadEnum<ProductType>(cells, columns, "type", lineNumber, errors);
        var container = ReadEnum<ProductContainer>(cells, columns, "container", lineNumber, errors);
        var saleUnit = ReadEnum<ProductSaleUnit>(cells, columns, "sale_unit", lineNumber, errors);

        var volume = ReadDouble(cells, columns, "volume_l", lineNumber, errors);
        var units = ReadInt(cells, columns, "units", lineNumber, errors) ?? 1;
        var alcohol = ReadDouble(cells, columns, "alcohol", lineNumber, errors);
        var plato = ReadDouble(cells, columns, "plato", lineNumber, errors);

        var unitWithoutVat = ReadDecimal(cells, columns, "unit_novat", lineNumber, errors);
        var unitWithVat = ReadDecimal(cells, columns, "unit_vat", lineNumber, errors);
        var packWithoutVat = ReadDecimal(cells, columns, "pack_novat", lineNumber, errors);
        var packWithVat = ReadDecimal(cells, columns, "pack_vat", lineNumber, errors);

        if (packWithVat is null && errors.Count == failures)
        {
            errors.Add(new PriceListParseError(lineNumber, PriceListErrorCodes.MissingValue,
                "pack_vat is required — it is the price every list prints."));
        }

        if (errors.Count != failures)
        {
            return null;
        }

        var prices = Derive(unitWithoutVat, unitWithVat, packWithoutVat, packWithVat!.Value, units);

        return new PriceListRow
        {
            PublicId = publicId,
            Name = name!.Trim(),
            Type = type!.Value,
            Container = container!.Value,
            SaleUnit = saleUnit!.Value,
            VolumeLiters = volume,
            UnitsPerPackage = units,
            AlcoholPercentage = alcohol is null ? null : (float)alcohol.Value,
            PlatoDegree = plato is null ? null : (float)plato.Value,
            UnitPriceWithoutVat = prices.UnitWithoutVat,
            UnitPriceWithVat = prices.UnitWithVat,
            PackPriceWithoutVat = prices.PackWithoutVat,
            PackPriceWithVat = packWithVat.Value,
            Derived = prices.Derived,
            Line = lineNumber
        };
    }

    /// <summary>
    /// Fills the prices a list leaves off. Printed figures are never recomputed: the lists round
    /// per-container and per-unit independently, so arithmetic disagrees with the page by a haléř
    /// often enough that trusting it would misstate real prices.
    /// </summary>
    private static (decimal? UnitWithoutVat, decimal? UnitWithVat, decimal? PackWithoutVat, PriceDerivation Derived)
        Derive(decimal? unitWithoutVat, decimal? unitWithVat, decimal? packWithoutVat, decimal packWithVat, int units)
    {
        var derived = PriceDerivation.None;
        var perUnit = Math.Max(1, units);

        if (unitWithVat is null)
        {
            unitWithVat = Round(packWithVat / perUnit);
            derived |= PriceDerivation.UnitPrice;
        }

        if (unitWithoutVat is null)
        {
            unitWithoutVat = Round(unitWithVat.Value / VatRate);
            derived |= PriceDerivation.UnitPrice | PriceDerivation.WithoutVat;
        }

        if (packWithoutVat is null)
        {
            // From the per-container figure when the list printed one, so the pack total stays
            // consistent with the number on the page rather than with a second rounding of the
            // with-VAT total.
            packWithoutVat = derived.HasFlag(PriceDerivation.WithoutVat)
                ? Round(packWithVat / VatRate)
                : Round(unitWithoutVat.Value * perUnit);
            derived |= PriceDerivation.PackPrice;
        }

        return (unitWithoutVat, unitWithVat, packWithoutVat, derived);
    }

    private static decimal Round(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);

    private static string NaturalKey(PriceListRow row) => string.Join('|',
        row.Name.Trim().ToLowerInvariant(), row.Container, row.VolumeLiters, row.SaleUnit,
        row.UnitsPerPackage);

    private static string? Cell(string[] cells, Dictionary<string, int> columns, string column) =>
        columns.TryGetValue(column, out var position) && position < cells.Length
            ? cells[position].Trim()
            : null;

    private static TEnum? ReadEnum<TEnum>(
        string[] cells, Dictionary<string, int> columns, string column, int lineNumber,
        List<PriceListParseError> errors) where TEnum : struct, Enum
    {
        var raw = Cell(cells, columns, column);
        if (string.IsNullOrWhiteSpace(raw))
        {
            errors.Add(new PriceListParseError(lineNumber, PriceListErrorCodes.MissingValue,
                $"{column} is required."));
            return null;
        }

        if (Enum.TryParse<TEnum>(raw, ignoreCase: true, out var value) && Enum.IsDefined(value))
        {
            return value;
        }

        errors.Add(new PriceListParseError(lineNumber, PriceListErrorCodes.InvalidEnum,
            $"'{raw}' is not a valid {column}."));
        return null;
    }

    private static Guid? ReadGuid(
        string[] cells, Dictionary<string, int> columns, string column, int lineNumber,
        List<PriceListParseError> errors)
    {
        var raw = Cell(cells, columns, column);
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        if (Guid.TryParse(raw, out var value))
        {
            return value;
        }

        // Deliberately an error rather than a fallback to a generated id: a typo here would detach
        // the row from the product it names, and the seed would quietly grow a duplicate.
        errors.Add(new PriceListParseError(lineNumber, PriceListErrorCodes.InvalidId,
            $"'{raw}' in {column} is not a GUID."));
        return null;
    }

    private static double? ReadDouble(
        string[] cells, Dictionary<string, int> columns, string column, int lineNumber,
        List<PriceListParseError> errors)
    {
        var raw = Cell(cells, columns, column);
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        if (double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
        {
            return value;
        }

        errors.Add(new PriceListParseError(lineNumber, PriceListErrorCodes.InvalidNumber,
            $"'{raw}' in {column} is not a number."));
        return null;
    }

    private static int? ReadInt(
        string[] cells, Dictionary<string, int> columns, string column, int lineNumber,
        List<PriceListParseError> errors)
    {
        var raw = Cell(cells, columns, column);
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        if (int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
            && value >= 1)
        {
            return value;
        }

        errors.Add(new PriceListParseError(lineNumber, PriceListErrorCodes.InvalidNumber,
            $"'{raw}' in {column} is not a whole number of at least 1."));
        return null;
    }

    private static decimal? ReadDecimal(
        string[] cells, Dictionary<string, int> columns, string column, int lineNumber,
        List<PriceListParseError> errors)
    {
        var raw = Cell(cells, columns, column);
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        if (decimal.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
        {
            return value;
        }

        errors.Add(new PriceListParseError(lineNumber, PriceListErrorCodes.InvalidNumber,
            $"'{raw}' in {column} is not a number."));
        return null;
    }
}
