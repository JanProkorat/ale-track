using System.Text.RegularExpressions;
using AleTrack.Common.Enums;

namespace AleTrack.Features.Products.Utils;

/// <summary>
/// Works out how many containers a product's sellable unit holds, from the product's own details.
/// Derived rather than entered: <see cref="Entities.Product.UnitsPerPackage"/> is set here whenever
/// a product is created or updated, and is deliberately absent from the API surface.
/// </summary>
/// <remarks>
/// Two independent rules, because the information sits in two different places.
///
/// Container size decides it for bottles: <c>ProductKind.Bottle</c> renders as "Basa", so the unit
/// is a crate — 20 at 0.5 l, 24 at 0.33 l. The 1 l and 2 l bottles are decorative and sold singly.
///
/// Everything else has to come from the name, because a multipack's count was never recorded
/// anywhere else ("Prim. Premium 8x", "Svijany 6 piv + sklenička"). Name parsing is inherently
/// approximate, so it applies only to the kinds that actually ship several containers together and
/// is bounded to a plausible pack size; anything unrecognised falls back to a single container,
/// which is the safe direction to be wrong in.
/// </remarks>
public static class ProductUnitsResolver
{
    /// <summary>Bottles per standard crate, by bottle size.</summary>
    private const int CrateOfHalfLitres = 20;
    private const int CrateOfThirdLitres = 24;

    /// <summary>
    /// A pack holds at least a pair and at most a crate's worth. Bounding the parse is what stops
    /// "Svijany 450 - 8x" resolving to 450.
    /// </summary>
    private const int MinPackCount = 2;
    private const int MaxPackCount = 24;

    /// <summary>"- 8x", "12 x", "6X".</summary>
    private static readonly Regex Multiplier = new(@"(\d+)\s*[xX]\b", RegexOptions.Compiled);

    /// <summary>"6-Pack", "6 pack".</summary>
    private static readonly Regex PackSuffix = new(@"(\d+)\s*-?\s*[pP]ack", RegexOptions.Compiled);

    /// <summary>"6 piv", "7 svijanských kousků" — a count followed by what is being counted.</summary>
    private static readonly Regex CountedNoun = new(
        @"(\d+)(?:\s+\S+)*?\s+(?:piv|kousk|lahv|plechov|ks\b)", RegexOptions.Compiled);

    public static int Resolve(ProductKind kind, double? packageSize, string? name)
    {
        // Bottles are crates, and the crate size follows from the bottle size.
        if (kind == ProductKind.Bottle)
        {
            return packageSize switch
            {
                BottleSize.ZeroPointFiveLiters => CrateOfHalfLitres,
                BottleSize.ZeroPointThreeThreeLiters => CrateOfThirdLitres,
                _ => 1,
            };
        }

        // Multipacks always hold several; a can occasionally does, when it is really a six-pack.
        if (kind is ProductKind.Multipack or ProductKind.Can)
            return ParsePackCount(name) ?? DefaultForMultiContainerKind(kind, packageSize);

        // A keg is one vessel, and anything else is assumed singular.
        return 1;
    }

    /// <summary>
    /// A multipack whose name says nothing useful. Duo packs are the one shape that can be inferred
    /// without help: the litre bottles only ever ship in pairs.
    /// </summary>
    private static int DefaultForMultiContainerKind(ProductKind kind, double? packageSize) =>
        kind == ProductKind.Multipack && packageSize == BottleSize.OneLiter ? 2 : 1;

    private static int? ParsePackCount(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return null;

        foreach (var pattern in (Regex[])[Multiplier, PackSuffix, CountedNoun])
        {
            foreach (var match in pattern.Matches(name).Cast<Match>())
            {
                if (int.TryParse(match.Groups[1].Value, out var count)
                    && count is >= MinPackCount and <= MaxPackCount)
                {
                    return count;
                }
            }
        }

        return null;
    }
}
