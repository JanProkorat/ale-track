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
