using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Import;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Breweries.Utils;

/// <summary>
/// Loads what a price-list import needs to know about a brewery, so the preview and the apply see
/// exactly the same picture.
/// </summary>
internal static class PriceListImportGraph
{
    /// <summary>
    /// Order states in which a line still describes goods that have to be delivered. A product
    /// referenced by one of these must survive an import even if the new list drops it.
    /// </summary>
    private static readonly OrderState[] OpenOrderStates =
        [OrderState.New, OrderState.Planning, OrderState.Delivering];

    /// <summary>
    /// The brewery, tracked, with its products — the graph an apply mutates.
    /// </summary>
    public static Task<Brewery?> LoadBreweryAsync(
        AleTrackDbContext dbContext, Guid publicId, CancellationToken ct) =>
        dbContext.Breweries
            .Include(b => b.Products)
            .FirstOrDefaultAsync(b => b.PublicId == publicId, ct);

    /// <summary>
    /// One state row per product of the brewery, each knowing whether it is still in use.
    /// </summary>
    /// <remarks>
    /// "In use" is resolved in two set-based queries rather than per product; asking per product
    /// would issue one round trip per row of the catalogue.
    /// </remarks>
    public static async Task<List<PriceListProductState>> LoadProductStatesAsync(
        AleTrackDbContext dbContext, Brewery brewery, CancellationToken ct)
    {
        var stocked = await dbContext.InventoryItems
            .AsNoTracking()
            .Where(i => i.ProductId != null && i.Quantity > 0)
            .Select(i => i.ProductId!.Value)
            .ToListAsync(ct);

        var ordered = await dbContext.Orders
            .AsNoTracking()
            .Where(o => OpenOrderStates.Contains(o.State))
            .SelectMany(o => o.OrderItems)
            .Select(i => i.ProductId)
            .ToListAsync(ct);

        var inUse = stocked.Concat(ordered).ToHashSet();

        return brewery.Products
            .Where(p => !p.IsDeleted)
            .Select(p => ToState(p, inUse.Contains(p.Id)))
            .ToList();
    }

    private static PriceListProductState ToState(Product product, bool isInUse) => new()
    {
        PublicId = product.PublicId,
        Name = product.Name,
        Type = product.Type,
        Container = product.Container,
        SaleUnit = product.SaleUnit,
        VolumeLiters = product.PackageSize,
        UnitsPerPackage = product.UnitsPerPackage,
        AlcoholPercentage = product.AlcoholPercentage,
        PlatoDegree = product.PlatoDegree,
        PriceWithVat = product.PriceWithVat,
        PriceWithoutVat = product.PriceWithoutVat,
        PriceForUnitWithVat = product.PriceForUnitWithVat,
        PriceForUnitWithoutVat = product.PriceForUnitWithoutVat,
        IsInUse = isInUse
    };
}
