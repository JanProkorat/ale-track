using AleTrack.Entities;

namespace AleTrack.Common.Utils;

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
