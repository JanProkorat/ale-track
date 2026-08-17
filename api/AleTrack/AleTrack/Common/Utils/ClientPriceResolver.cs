using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Common.Utils;

/// <summary>
/// The four effective price fields for one product and one client.
/// </summary>
/// <remarks>
/// <see cref="ListPriceWithVat"/> is non-null only when a client price is being applied,
/// so a non-null value is itself the signal that the row is a special price.
/// </remarks>
public readonly record struct ResolvedPrice(
    decimal PriceWithVat,
    decimal? PriceWithoutVat,
    decimal? PriceForUnitWithVat,
    decimal? PriceForUnitWithoutVat,
    decimal? ListPriceWithVat);

/// <summary>
/// A client's price overrides, keyed by product id.
/// </summary>
public sealed class ClientPriceList(IReadOnlyDictionary<long, decimal> pricesByProductId)
{
    /// <summary>
    /// A client with no overrides, and the value to use when no client is in scope.
    /// </summary>
    public static ClientPriceList Empty { get; } = new(new Dictionary<long, decimal>());

    /// <summary>
    /// Resolves the effective prices for a product.
    /// </summary>
    public ResolvedPrice Resolve(Product product)
    {
        if (!pricesByProductId.TryGetValue(product.Id, out var overridePrice))
        {
            return new ResolvedPrice(
                product.PriceWithVat,
                product.PriceWithoutVat,
                product.PriceForUnitWithVat,
                product.PriceForUnitWithoutVat,
                null);
        }

        // A product priced at zero has no ratio to scale by; the override takes the
        // headline price and the derived fields keep the product's own values.
        if (product.PriceWithVat == 0m)
        {
            return new ResolvedPrice(
                overridePrice,
                product.PriceWithoutVat,
                product.PriceForUnitWithVat,
                product.PriceForUnitWithoutVat,
                product.PriceWithVat);
        }

        var ratio = overridePrice / product.PriceWithVat;

        return new ResolvedPrice(
            overridePrice,
            Scale(product.PriceWithoutVat, ratio),
            Scale(product.PriceForUnitWithVat, ratio),
            Scale(product.PriceForUnitWithoutVat, ratio),
            product.PriceWithVat);
    }

    private static decimal? Scale(decimal? value, decimal ratio) =>
        value is null ? null : Math.Round(value.Value * ratio, 2, MidpointRounding.AwayFromZero);
}

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
