using AleTrack.Entities;
using AleTrack.Features.Products.Import;
using AleTrack.Features.Products.Utils;

namespace AleTrack.Features.Breweries.Utils;

/// <summary>
/// What applying a price list did: the provenance row to persist, and the products to remove.
/// </summary>
/// <param name="Import">Provenance for the whole import.</param>
/// <param name="Removed">Products the list dropped. Removal is soft — the DbContext turns it into a flag.</param>
public sealed record PriceListApplyOutcome(PriceListImport Import, List<Product> Removed);

/// <summary>
/// Writes a computed diff onto a brewery's product graph.
/// </summary>
/// <remarks>
/// Deliberately free of both the database and the clock: it mutates tracked entities and hands back
/// what it did, so the endpoint owns the single <c>SaveChangesAsync</c> that makes the whole import
/// one transaction, and a test can pin the timestamp without a running application.
/// </remarks>
public static class PriceListApplier
{
    /// <summary>
    /// Applies <paramref name="entries"/> to <paramref name="brewery"/>.
    /// </summary>
    public static PriceListApplyOutcome Apply(
        Brewery brewery,
        IReadOnlyList<PriceListDiffEntry> entries,
        DateOnly effectiveFrom,
        DateTimeOffset importedAt,
        string sourceHash,
        string? sourceName,
        long? importedByUserId)
    {
        var byPublicId = brewery.Products.ToDictionary(p => p.PublicId);
        var removed = new List<Product>();
        var added = 0;
        var updated = 0;

        foreach (var entry in entries)
        {
            switch (entry.Kind)
            {
                case PriceListChangeKind.Added:
                    brewery.Products.Add(Create(entry.Row!, effectiveFrom));
                    added++;
                    break;

                case PriceListChangeKind.Repriced:
                case PriceListChangeKind.Changed:
                    Update(byPublicId[entry.Existing!.PublicId], entry.Row!, effectiveFrom);
                    updated++;
                    break;

                case PriceListChangeKind.Unchanged:
                    // Nothing to write but the provenance: this list states these prices too, and
                    // that is worth recording even though it did not move them.
                    byPublicId[entry.Existing!.PublicId].PriceEffectiveFrom = effectiveFrom;
                    break;

                case PriceListChangeKind.ToRemove:
                    removed.Add(byPublicId[entry.Existing!.PublicId]);
                    break;

                case PriceListChangeKind.Blocked:
                default:
                    // Reported to the user, never touched.
                    break;
            }
        }

        var import = new PriceListImport
        {
            PublicId = Guid.NewGuid(),
            BreweryId = brewery.Id,
            Brewery = brewery,
            EffectiveFrom = effectiveFrom,
            SourceName = sourceName,
            SourceHash = sourceHash,
            ImportedAt = importedAt,
            ImportedByUserId = importedByUserId,
            AddedCount = added,
            UpdatedCount = updated,
            RemovedCount = removed.Count
        };

        return new PriceListApplyOutcome(import, removed);
    }

    private static Product Create(PriceListRow row, DateOnly effectiveFrom)
    {
        var product = new Product
        {
            PublicId = row.PublicId ?? Guid.NewGuid(),
            Name = row.Name,
            Container = row.Container,
            SaleUnit = row.SaleUnit,
            Kind = ProductPackaging.DeriveKind(row.Container, row.SaleUnit),
            PackageSize = row.VolumeLiters,
            UnitsPerPackage = row.UnitsPerPackage
        };

        Update(product, row, effectiveFrom);
        return product;
    }

    /// <summary>
    /// Writes the fields a list owns. The stored name is left alone on purpose — the list prints
    /// "Svijanský Máz 11%" where the catalogue holds "Svijanský Máz", and letting an import rewrite
    /// that would rename the whole catalogue the first time one ran.
    /// </summary>
    private static void Update(Product product, PriceListRow row, DateOnly effectiveFrom)
    {
        product.Type = row.Type;
        product.AlcoholPercentage = row.AlcoholPercentage;
        product.PlatoDegree = row.PlatoDegree;
        product.PriceWithVat = row.PackPriceWithVat;
        product.PriceWithoutVat = row.PackPriceWithoutVat;
        product.PriceForUnitWithVat = row.UnitPriceWithVat;
        product.PriceForUnitWithoutVat = row.UnitPriceWithoutVat;
        product.PriceEffectiveFrom = effectiveFrom;
    }
}
