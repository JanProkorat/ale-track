using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Sales.Utils;

/// <summary>
/// Builds <see cref="SaleItem"/> lines from client-supplied <see cref="SaleItemDto"/>s, snapshotting
/// the descriptive fields from the stock row.
/// </summary>
/// <remarks>
/// Shared by the create and update commands on purpose: two copies of the snapshot logic would
/// drift, and a line that snapshots differently depending on which endpoint wrote it is a
/// history-integrity bug rather than a cosmetic one.
/// </remarks>
public static class SaleLineWriter
{
    /// <summary>
    /// Resolves every DTO line into a snapshotted <see cref="SaleItem"/>.
    /// </summary>
    /// <param name="dbContext">Database context.</param>
    /// <param name="items">Lines as sent by the client.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The built lines, in the order they were sent.</returns>
    /// <exception cref="AleTrackException">
    /// Thrown with 404 when a referenced inventory item does not exist.
    /// </exception>
    public static async Task<List<SaleItem>> BuildLinesAsync(
        AleTrackDbContext dbContext,
        ICollection<SaleItemDto> items,
        CancellationToken ct)
    {
        var requestedIds = items.Select(i => i.InventoryItemId).Distinct().ToList();

        var stockRows = (await dbContext.InventoryItems
                .AsNoTracking()
                .Include(i => i.Product)
                .Where(i => requestedIds.Contains(i.PublicId))
                .ToListAsync(ct))
            .ToDictionary(i => i.PublicId);

        var missing = requestedIds.Where(id => !stockRows.ContainsKey(id)).ToList();
        if (missing.Count > 0)
        {
            ThrowHelper.PublicEntitiesNotFound(nameof(InventoryItem), missing);
        }

        return items.Select(dto =>
        {
            var stock = stockRows[dto.InventoryItemId];

            return new SaleItem
            {
                InventoryItemId = stock.Id,
                ProductId = stock.ProductId,
                Name = stock.Product?.Name ?? stock.Name!,
                Kind = stock.Product?.Kind,
                PackageSize = stock.Product?.PackageSize,
                Quantity = dto.Quantity,
                UnitPriceWithVat = dto.UnitPriceWithVat ?? 0m,
                ListPriceWithVat = stock.Product?.PriceWithVat,
                Note = dto.Note
            };
        }).ToList();
    }
}
