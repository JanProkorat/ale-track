using System.Text.Json.Serialization;

namespace AleTrack.ExchangeRateDownloader;

internal sealed record ExchangeRateResponse
{
    /// <summary>
    /// Day of the exchange rates in the format "yyyyMMdd".
    /// </summary>
    [JsonPropertyName("den")]
    public string Date { get; set; } = null!;

    /// <summary>
    /// A dictionary containing exchange rates, where the key is the currency code
    /// and the value is an <see cref="ExchangeRate"/> object.
    /// </summary>
    [JsonPropertyName("kurzy")]
    public Dictionary<string, ExchangeRate> Rates { get; set; } = new();
}

internal record ExchangeRate
{
    /// <summary>
    /// Average rate of the currency.
    /// </summary>
    [JsonPropertyName("dev_stred")]
    public decimal AvrRate { get; set; }
}