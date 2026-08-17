using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Common.Utils;

/// <summary>
/// Loads a client's price overrides.
/// </summary>
public static class ClientPriceResolver
{
    /// <summary>
    /// Loads the price list for a client by database id.
    /// </summary>
    public static async Task<ClientPriceList> LoadAsync(
        AleTrackDbContext dbContext,
        long clientId,
        CancellationToken ct)
    {
        var prices = await dbContext.ClientProductPrices
            .AsNoTracking()
            .Where(p => p.ClientId == clientId)
            .Select(p => new { p.ProductId, p.PriceWithVat })
            .ToListAsync(ct);

        return new ClientPriceList(prices.ToDictionary(p => p.ProductId, p => p.PriceWithVat));
    }

    /// <summary>
    /// Loads the price list for a client by public id. Returns an empty list when the
    /// client id is null — a walk-in counter sale, or a query with no client in scope.
    /// </summary>
    public static async Task<ClientPriceList> LoadByPublicIdAsync(
        AleTrackDbContext dbContext,
        Guid? clientPublicId,
        CancellationToken ct)
    {
        if (clientPublicId is null)
        {
            return ClientPriceList.Empty;
        }

        var prices = await dbContext.ClientProductPrices
            .AsNoTracking()
            .Where(p => p.Client.PublicId == clientPublicId.Value)
            .Select(p => new { p.ProductId, p.PriceWithVat })
            .ToListAsync(ct);

        return new ClientPriceList(prices.ToDictionary(p => p.ProductId, p => p.PriceWithVat));
    }
}
