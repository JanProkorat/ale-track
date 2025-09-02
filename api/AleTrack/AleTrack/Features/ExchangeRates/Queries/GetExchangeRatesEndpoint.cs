using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ExchangeRates.Queries;

/// <summary>
/// Endpoint that handles the retrieval of exchange rates.
/// </summary>
/// <remarks>
/// This endpoint fetches a list of exchange rates from the database and returns it as a response.
/// It uses the AleTrackDbContext to query the exchange rate entities, which are mapped into DTOs.
/// </remarks>
/// <example>
/// Configures the endpoint to handle HTTP GET requests at the "orders" route.
/// Requires the user to possess the "User" role for access and provides response summaries.
/// </example>
public class GetExchangeRatesEndpoint(AleTrackDbContext dbContext) : EndpointWithoutRequest<List<ExchangeRateDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("exchange-rates");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetExchangeRatesEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets list of exchange rates";
            s.Responses[StatusCodes.Status200OK] = "List of exchange rates";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var data = await dbContext.ExchangeRates
            .Select(o => new ExchangeRateDto
            {
                CurrencyCode = o.CurrencyCode,
                Rate = o.Rate
            })
            .ToListAsync(ct);

        await SendOkAsync(data, cancellation: ct);
    }
}