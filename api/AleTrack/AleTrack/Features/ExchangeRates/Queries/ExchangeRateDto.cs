namespace AleTrack.Features.ExchangeRates.Queries;

public record ExchangeRateDto
{
    /// <summary>
    /// Code of the currency
    /// </summary>
    public string CurrencyCode { get; set; } = null!;
    
    /// <summary>
    /// Current exchange rate
    /// </summary>
    public decimal Rate { get; set; }
}