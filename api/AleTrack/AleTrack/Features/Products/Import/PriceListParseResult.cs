namespace AleTrack.Features.Products.Import;

/// <summary>
/// Stable codes for price-list parse failures. Surfaced to the frontend, so they do not change.
/// </summary>
public static class PriceListErrorCodes
{
    public const string MissingColumn = "PRICE_LIST_MISSING_COLUMN";
    public const string MissingHeader = "PRICE_LIST_MISSING_HEADER";
    public const string InvalidNumber = "PRICE_LIST_INVALID_NUMBER";
    public const string InvalidEnum = "PRICE_LIST_INVALID_ENUM";
    public const string InvalidDate = "PRICE_LIST_INVALID_DATE";
    public const string InvalidId = "PRICE_LIST_INVALID_ID";
    public const string NameTooLong = "PRICE_LIST_NAME_TOO_LONG";
    public const string MissingValue = "PRICE_LIST_MISSING_VALUE";
    public const string DuplicateRow = "PRICE_LIST_DUPLICATE_ROW";
    public const string NoRows = "PRICE_LIST_NO_ROWS";
}

/// <summary>
/// One reason a price list could not be read.
/// </summary>
/// <param name="Line">1-based line in the source file, or null for a whole-file problem.</param>
/// <param name="Code">One of <see cref="PriceListErrorCodes"/>.</param>
/// <param name="Message">Human-readable detail.</param>
public sealed record PriceListParseError(int? Line, string Code, string Message);

/// <summary>
/// Outcome of parsing a price list: either a catalogue or the reasons there isn't one.
/// </summary>
public sealed record PriceListParseResult(PriceListCatalog? Catalog, List<PriceListParseError> Errors)
{
    /// <summary>Whether a catalogue was produced.</summary>
    public bool Succeeded => Errors.Count == 0 && Catalog is not null;
}
