namespace AleTrack.Features.ClientProductPrices.Commands;

/// <summary>
/// Body of a client product price write. Only the price with VAT is entered; the other
/// three price fields are derived from the product's own ratios at read time.
/// </summary>
public sealed record SaveClientProductPriceDto
{
    /// <summary>The price this client pays, with VAT</summary>
    public decimal PriceWithVat { get; set; }
}
