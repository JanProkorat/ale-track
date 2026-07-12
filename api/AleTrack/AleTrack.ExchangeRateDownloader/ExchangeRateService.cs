using System.Text.Json;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Serilog;

namespace AleTrack.ExchangeRateDownloader;

public class ExchangeRateService(HttpClient httpClient, AleTrackDbContext dbContext, ILogger logger, IConfiguration config)
{
    private const string EurCurrencyCode = "EUR";
    
    public async Task GetCurrentRateAsync()
    {
        var url = config["RatesApiUrl"] ?? throw new InvalidOperationException("RatesApiUrl not configured");
        var json = await httpClient.GetStringAsync(url);

        var data = JsonSerializer.Deserialize<ExchangeRateResponse>(json);

        if (data?.Rates == null)
        {
            logger.Error("Failed to deserialize exchange rate data or rates are null");
            return;
        }

        var date = DateOnly.ParseExact(data.Date, "yyyyMMdd", null);

        if (!data.Rates.TryGetValue(EurCurrencyCode, out var eurRate))
        {
            logger.Error("EUR rate not found in the response for date {Date}", date);
            return;
        }

        var existingRate = await dbContext.ExchangeRates.FirstOrDefaultAsync(r => r.CurrencyCode == EurCurrencyCode, CancellationToken.None);
        if (existingRate is null)
        {
            var newRate = new Entities.ExchangeRate
            {
                CurrencyCode = EurCurrencyCode,
                Rate = eurRate.AvrRate,
                UpdatedDate = date
            };
            dbContext.ExchangeRates.Add(newRate);
        }
        else
        {
            existingRate.Rate = eurRate.AvrRate;
            existingRate.UpdatedDate = date;
            dbContext.ExchangeRates.Update(existingRate);
        }
        
        await dbContext.SaveChangesAsync();
        logger.Information("Exchange rate for {CurrencyCode} updated to {Rate} on {Date}", EurCurrencyCode, eurRate.AvrRate, date);
    }
}