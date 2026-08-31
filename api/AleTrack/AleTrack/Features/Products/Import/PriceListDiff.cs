using System.Globalization;
using AleTrack.Common.Enums;

namespace AleTrack.Features.Products.Import;

/// <summary>
/// What one product in the database looks like to an import — enough to match it, decide whether
/// the list changes it, and know whether it may be removed.
/// </summary>
public sealed record PriceListProductState
{
    /// <summary>Public identity of the stored product.</summary>
    public required Guid PublicId { get; init; }

    /// <summary>Stored name, in whatever form the catalogue holds it.</summary>
    public required string Name { get; init; }

    /// <summary>Beer style.</summary>
    public required ProductType Type { get; init; }

    /// <summary>The vessel the drink is in.</summary>
    public required ProductContainer Container { get; init; }

    /// <summary>What one sellable unit is.</summary>
    public required ProductSaleUnit SaleUnit { get; init; }

    /// <summary>Volume of one container, in litres.</summary>
    public double? VolumeLiters { get; init; }

    /// <summary>Containers per sellable unit.</summary>
    public required int UnitsPerPackage { get; init; }

    /// <summary>Alcohol by volume, in percent.</summary>
    public float? AlcoholPercentage { get; init; }

    /// <summary>Degree (stupňovitost).</summary>
    public float? PlatoDegree { get; init; }

    /// <summary>Price of one sellable unit, with VAT.</summary>
    public required decimal PriceWithVat { get; init; }

    /// <summary>Price of one sellable unit, without VAT.</summary>
    public decimal? PriceWithoutVat { get; init; }

    /// <summary>Price of one container, with VAT.</summary>
    public decimal? PriceForUnitWithVat { get; init; }

    /// <summary>Price of one container, without VAT.</summary>
    public decimal? PriceForUnitWithoutVat { get; init; }

    /// <summary>
    /// Whether stock is on hand or an open order refers to this product. Such a product is
    /// reported when a list drops it, never removed.
    /// </summary>
    public required bool IsInUse { get; init; }
}

/// <summary>
/// Which bucket one row of an import diff falls into.
/// </summary>
public enum PriceListChangeKind
{
    /// <summary>Natural key absent from the database.</summary>
    Added = 1,

    /// <summary>Matched, and only price fields differ.</summary>
    Repriced = 2,

    /// <summary>Matched, and at least one non-price field differs.</summary>
    Changed = 3,

    /// <summary>Matched, nothing differs.</summary>
    Unchanged = 4,

    /// <summary>In the database, absent from the list, safe to remove.</summary>
    ToRemove = 5,

    /// <summary>In the database, absent from the list, but in use.</summary>
    Blocked = 6
}

/// <summary>
/// One field an import would change.
/// </summary>
/// <param name="Field">Property name, as the frontend keys its labels on.</param>
/// <param name="Before">Stored value, formatted.</param>
/// <param name="After">Value the list states, formatted.</param>
public sealed record PriceListFieldChange(string Field, string? Before, string? After);

/// <summary>
/// One product's place in an import.
/// </summary>
public sealed record PriceListDiffEntry
{
    /// <summary>Which bucket this product falls into.</summary>
    public required PriceListChangeKind Kind { get; init; }

    /// <summary>Name to show — the list's for an incoming row, the database's otherwise.</summary>
    public required string Name { get; init; }

    /// <summary>The stored product, when one matched.</summary>
    public PriceListProductState? Existing { get; init; }

    /// <summary>The list row, when the product is on the list.</summary>
    public PriceListRow? Row { get; init; }

    /// <summary>Fields this import would change. Empty for every bucket but Repriced and Changed.</summary>
    public IReadOnlyList<PriceListFieldChange> Changes { get; init; } = [];
}

/// <summary>
/// Compares a parsed price list against the brewery's stored products.
/// </summary>
/// <remarks>
/// Pure: it reads no database and writes nothing, so both the preview and the apply can run it and
/// cannot reach different conclusions about the same file.
/// </remarks>
public static class PriceListDiff
{
    /// <summary>
    /// The full diff, one entry per row of the list plus one per stored product the list omits.
    /// Buckets are evaluated in the order the design fixes, so each product lands in exactly one.
    /// </summary>
    public static List<PriceListDiffEntry> Compute(
        IEnumerable<PriceListRow> rows, IEnumerable<PriceListProductState> existing)
    {
        var rowList = rows.ToList();
        var storedList = existing.ToList();

        var byStrictKey = new Dictionary<string, PriceListProductState>();
        foreach (var product in storedList)
        {
            // A catalogue that already holds the same product twice must not fail the import: the
            // list names it once, so the first copy matches and the rest are proposed for removal.
            byStrictKey.TryAdd(KeyOf(product), product);
        }

        var matches = new PriceListProductState?[rowList.Count];
        var claimed = new HashSet<Guid>();

        for (var i = 0; i < rowList.Count; i++)
        {
            if (byStrictKey.TryGetValue(KeyOf(rowList[i]), out var product))
            {
                matches[i] = product;
                claimed.Add(product.PublicId);
            }
        }

        MatchOnLooseKey(rowList, storedList, matches, claimed);

        var entries = new List<PriceListDiffEntry>();

        for (var i = 0; i < rowList.Count; i++)
        {
            var row = rowList[i];
            var product = matches[i];

            if (product is null)
            {
                entries.Add(new PriceListDiffEntry
                {
                    Kind = PriceListChangeKind.Added,
                    Name = row.Name,
                    Row = row
                });
                continue;
            }

            var priceChanges = PriceChanges(product, row);
            var otherChanges = NonPriceChanges(product, row);

            entries.Add(new PriceListDiffEntry
            {
                // A non-price difference outranks a price one: the row is Changed whether or not
                // the price moved, so a type correction is never reported as a mere reprice.
                Kind = otherChanges.Count > 0
                    ? PriceListChangeKind.Changed
                    : priceChanges.Count > 0
                        ? PriceListChangeKind.Repriced
                        : PriceListChangeKind.Unchanged,
                Name = row.Name,
                Existing = product,
                Row = row,
                Changes = [.. otherChanges, .. priceChanges]
            });
        }

        foreach (var product in storedList.Where(p => !claimed.Contains(p.PublicId)))
        {
            entries.Add(new PriceListDiffEntry
            {
                Kind = product.IsInUse ? PriceListChangeKind.Blocked : PriceListChangeKind.ToRemove,
                Name = product.Name,
                Existing = product
            });
        }

        return entries;
    }

    /// <summary>
    /// Second matching pass: pairs a row the strict key missed with the stored product it is
    /// plainly a restatement of, so the import corrects that product instead of inserting a copy.
    /// </summary>
    /// <remarks>
    /// Why this exists: the <c>AddProductPackaging</c> migration guessed each legacy row's sale
    /// unit and count, and a wrong guess puts the stored product permanently out of the strict
    /// key's reach — the list's 24-can tray keys as <c>Tray|24</c> while the stored row keys as
    /// <c>Single|1</c>, so every import files the tray as new and leaves the wrong copy behind.
    ///
    /// Only an unambiguous pair is taken: exactly one unmatched row and exactly one unclaimed
    /// product sharing a <see cref="PriceListNormalizer.LooseKey"/>. Two rows competing for one
    /// stored product (a list that sells both a 12-can and a 24-can tray, against a single legacy
    /// row) has no non-arbitrary answer, so both stay <see cref="PriceListChangeKind.Added"/> and
    /// the stored row is reported for removal — the old behaviour, which a person can then judge.
    /// </remarks>
    private static void MatchOnLooseKey(
        List<PriceListRow> rows,
        List<PriceListProductState> stored,
        PriceListProductState?[] matches,
        HashSet<Guid> claimed)
    {
        var rowsPerLooseKey = new Dictionary<string, int>();
        for (var i = 0; i < rows.Count; i++)
        {
            if (matches[i] is not null)
            {
                continue;
            }

            var looseKey = LooseKeyOf(rows[i]);
            rowsPerLooseKey[looseKey] = rowsPerLooseKey.GetValueOrDefault(looseKey) + 1;
        }

        if (rowsPerLooseKey.Count == 0)
        {
            return;
        }

        var candidates = stored
            .Where(p => !claimed.Contains(p.PublicId))
            .GroupBy(LooseKeyOf)
            .ToDictionary(g => g.Key, g => g.ToList());

        for (var i = 0; i < rows.Count; i++)
        {
            if (matches[i] is not null)
            {
                continue;
            }

            var looseKey = LooseKeyOf(rows[i]);
            if (rowsPerLooseKey[looseKey] != 1
                || !candidates.TryGetValue(looseKey, out var pool)
                || pool.Count != 1)
            {
                continue;
            }

            matches[i] = pool[0];
            claimed.Add(pool[0].PublicId);
        }
    }

    private static string KeyOf(PriceListRow row) =>
        PriceListNormalizer.Key(row.Name, row.Container, row.VolumeLiters, row.SaleUnit, row.UnitsPerPackage);

    private static string KeyOf(PriceListProductState product) =>
        PriceListNormalizer.Key(
            product.Name, product.Container, product.VolumeLiters, product.SaleUnit, product.UnitsPerPackage);

    private static string LooseKeyOf(PriceListRow row) =>
        PriceListNormalizer.LooseKey(row.Name, row.Container, row.VolumeLiters);

    private static string LooseKeyOf(PriceListProductState product) =>
        PriceListNormalizer.LooseKey(product.Name, product.Container, product.VolumeLiters);

    private static List<PriceListFieldChange> PriceChanges(PriceListProductState product, PriceListRow row)
    {
        List<PriceListFieldChange> changes = [];

        Add(changes, nameof(product.PriceWithVat), product.PriceWithVat, row.PackPriceWithVat);
        Add(changes, nameof(product.PriceWithoutVat), product.PriceWithoutVat, row.PackPriceWithoutVat);
        Add(changes, nameof(product.PriceForUnitWithVat), product.PriceForUnitWithVat, row.UnitPriceWithVat);
        Add(changes, nameof(product.PriceForUnitWithoutVat), product.PriceForUnitWithoutVat, row.UnitPriceWithoutVat);

        return changes;
    }

    private static List<PriceListFieldChange> NonPriceChanges(PriceListProductState product, PriceListRow row)
    {
        List<PriceListFieldChange> changes = [];

        if (product.Type != row.Type)
        {
            changes.Add(new PriceListFieldChange(nameof(product.Type), product.Type.ToString(), row.Type.ToString()));
        }

        // Both are part of the strict key, so a strictly matched row can never report them. They
        // are here for the loose match, where the corrected packaging is the whole point of the
        // entry — and the reason it reads as Changed rather than a silent reprice.
        if (product.SaleUnit != row.SaleUnit)
        {
            changes.Add(new PriceListFieldChange(
                nameof(product.SaleUnit), product.SaleUnit.ToString(), row.SaleUnit.ToString()));
        }

        if (product.UnitsPerPackage != row.UnitsPerPackage)
        {
            changes.Add(new PriceListFieldChange(
                nameof(product.UnitsPerPackage),
                product.UnitsPerPackage.ToString(CultureInfo.InvariantCulture),
                row.UnitsPerPackage.ToString(CultureInfo.InvariantCulture)));
        }

        AddFloat(changes, nameof(product.AlcoholPercentage), product.AlcoholPercentage, row.AlcoholPercentage);
        AddFloat(changes, nameof(product.PlatoDegree), product.PlatoDegree, row.PlatoDegree);

        return changes;
    }

    private static void Add(
        List<PriceListFieldChange> changes, string field, decimal? before, decimal? after)
    {
        if (before == after)
        {
            return;
        }

        changes.Add(new PriceListFieldChange(field, Format(before), Format(after)));
    }

    private static void AddFloat(
        List<PriceListFieldChange> changes, string field, float? before, float? after)
    {
        // Both sides originate as printed decimals widened to float, so a tolerance keeps a
        // representation difference from being reported as a change to a value nobody edited.
        if (before is null && after is null)
        {
            return;
        }

        if (before is not null && after is not null && Math.Abs(before.Value - after.Value) < 0.001f)
        {
            return;
        }

        changes.Add(new PriceListFieldChange(field, Format(before), Format(after)));
    }

    private static string? Format(decimal? value) =>
        value?.ToString("0.##", CultureInfo.InvariantCulture);

    private static string? Format(float? value) =>
        value?.ToString("0.##", CultureInfo.InvariantCulture);
}
