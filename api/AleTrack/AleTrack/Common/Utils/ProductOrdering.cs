using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Common.Utils;

/// <summary>
/// The one order products are listed in across the app — catalogues, orders,
/// shipments, deliveries, the sklad and the invoices.
/// </summary>
/// <remarks>
/// <para>
/// Asked for by the customer: sort by degree (stupňovitost) everywhere, and put the
/// soft drinks at the end. So within a brewery: beer first, ordered by degree and
/// then by package size; everything that is not beer (limonáda, merch, ostatní)
/// after it. A beer with no degree recorded (nealko, radler) is still a beer and
/// sorts after the degreed ones, in front of the non-beers.
/// </para>
/// <para>
/// EF Core cannot translate a method call inside a projection, so a collection
/// ordered inside a <c>Select</c> has to spell the chain out. Those sites carry a
/// pointer back here; <see cref="Compare"/> is the same rule in memory and the
/// tests hold both to it.
/// </para>
/// <para>
/// The explicit <c>PlatoDegree == null</c> clause is deliberate. PostgreSQL sorts
/// nulls last on an ascending order by default while LINQ-to-Objects sorts them
/// first, so leaving it out would order one way in production and the other way in
/// the tests.
/// </para>
/// </remarks>
public static class ProductOrdering
{
    /// <summary>
    /// Types that are not beer and belong after it. Nealko and radler are absent on
    /// purpose — they are beer, they just have no degree.
    /// </summary>
    public static bool IsNonBeer(ProductType type)
        => type is ProductType.Lemonade or ProductType.Merchandise or ProductType.Other;

    /// <summary>Beer sorts before everything else.</summary>
    public static int Rank(ProductType type) => IsNonBeer(type) ? 1 : 0;

    /// <summary>
    /// Orders a product query for display, brewery by brewery.
    /// </summary>
    public static IOrderedQueryable<Product> OrderForDisplay(this IQueryable<Product> products)
        => products
            .OrderBy(p => p.Brewery.DisplayOrder)
            .ThenBy(p => p.Type == ProductType.Lemonade
                      || p.Type == ProductType.Merchandise
                      || p.Type == ProductType.Other ? 1 : 0)
            .ThenBy(p => p.PlatoDegree == null)
            .ThenBy(p => p.PlatoDegree)
            .ThenBy(p => p.PackageSize)
            .ThenBy(p => p.Name);

    /// <summary>
    /// Orders the products of a single brewery — same rule without the brewery key.
    /// </summary>
    public static IOrderedQueryable<Product> OrderForDisplayWithinBrewery(this IQueryable<Product> products)
        => products
            .OrderBy(p => p.Type == ProductType.Lemonade
                       || p.Type == ProductType.Merchandise
                       || p.Type == ProductType.Other ? 1 : 0)
            .ThenBy(p => p.PlatoDegree == null)
            .ThenBy(p => p.PlatoDegree)
            .ThenBy(p => p.PackageSize)
            .ThenBy(p => p.Name);

    /// <summary>
    /// The same rule in memory, for the places that order materialised objects
    /// (the invoice mapper) rather than a query.
    /// </summary>
    public static int Compare(
        (ProductType Type, float? PlatoDegree, double? PackageSize, string Name) a,
        (ProductType Type, float? PlatoDegree, double? PackageSize, string Name) b)
    {
        var byRank = Rank(a.Type).CompareTo(Rank(b.Type));
        if (byRank != 0) return byRank;

        // Missing degree last within its rank.
        var byMissing = (a.PlatoDegree is null).CompareTo(b.PlatoDegree is null);
        if (byMissing != 0) return byMissing;

        var byDegree = Nullable.Compare(a.PlatoDegree, b.PlatoDegree);
        if (byDegree != 0) return byDegree;

        var bySize = Nullable.Compare(a.PackageSize, b.PackageSize);
        if (bySize != 0) return bySize;

        return string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase);
    }
}
