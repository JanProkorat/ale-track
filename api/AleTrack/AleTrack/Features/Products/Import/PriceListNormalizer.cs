using System.Globalization;
using System.Text.RegularExpressions;
using AleTrack.Common.Enums;

namespace AleTrack.Features.Products.Import;

/// <summary>
/// Turns a printed product name and its packaging into the key an import matches on.
/// </summary>
/// <remarks>
/// Load-bearing, not cosmetic. The list says <c>Svijanský Máz 11%</c> and the database says
/// <c>Svijanský Máz</c>; the list says <c>Svijanský Kvasničák 13% – 2L</c> where the size is
/// already a column of its own. Without stripping both suffixes the first import would report the
/// entire catalogue as new and propose removing all of it.
/// </remarks>
public static partial class PriceListNormalizer
{
    /// <summary>
    /// The product name with the printed degree and size suffixes removed and inner whitespace
    /// collapsed. Diacritics are kept — they distinguish real products.
    /// </summary>
    public static string Name(string name)
    {
        var trimmed = CollapseWhitespace().Replace(name.Trim(), " ");

        // Size first: "Svijanský Kvasničák 13% – 2L" loses "– 2L", which then exposes the degree.
        trimmed = SizeSuffix().Replace(trimmed, string.Empty);
        trimmed = DegreeSuffix().Replace(trimmed, string.Empty);

        return trimmed.Trim();
    }

    /// <summary>
    /// The natural key a list row and a stored product are matched on, within one brewery.
    /// </summary>
    public static string Key(
        string name, ProductContainer container, double? volumeLiters, ProductSaleUnit saleUnit,
        int unitsPerPackage) =>
        string.Join('|',
            Name(name).ToLowerInvariant(),
            container,
            // Formatted rather than compared as a double so 0.5 and 0.50 cannot key differently.
            volumeLiters?.ToString("0.###", CultureInfo.InvariantCulture) ?? string.Empty,
            saleUnit,
            unitsPerPackage);

    [GeneratedRegex(@"\s+")]
    private static partial Regex CollapseWhitespace();

    /// <summary>Trailing "11%" or "12°" — the degree the list prints in the product name.</summary>
    [GeneratedRegex(@"\s+\d{1,2}\s*[%°]$")]
    private static partial Regex DegreeSuffix();

    /// <summary>
    /// Trailing "– 2L", "- 0,5 l" or a bare "lahev 1L" — a size the packaging columns already
    /// carry. The dash is optional because only some sections print one, and a size is only ever
    /// stripped when it ends the name, so "Svijany 450" and "Svijany 20 - výroční pivo" survive.
    /// </summary>
    [GeneratedRegex(@"\s*(?:[-–—]\s*)?\d+(?:[.,]\d+)?\s*[lL]$")]
    private static partial Regex SizeSuffix();
}
