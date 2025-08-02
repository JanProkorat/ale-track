using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Breweries.Queries.List;

/// <summary>
/// Endpoint for retrieving a filtered list of breweries.
/// </summary>
/// <remarks>
/// This endpoint is configured to respond to HTTP GET requests at the "breweries" route.
/// It requires the user to have the "User" role and handles requests with filtering and sorting capabilities passed via query parameters.
/// </remarks>
/// <example>
/// The endpoint responds with a list of `BreweryListItemDto` objects, representing each brewery's identifier and name.
/// </example>
public sealed class GetBreweriesListEndpoint(AleTrackDbContext dbContext) : Endpoint<FilterableRequest, List<BreweryListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("breweries");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetBreweriesListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered breweries list";
            s.Responses[StatusCodes.Status200OK] = "List of breweries";
        });
    }
    
    /// <inheritdoc />
    public override async Task HandleAsync(FilterableRequest req, CancellationToken ct)
    {
        var data = await dbContext.Breweries
            .Select(c => new BreweryListItemDto
            {
                Id = c.PublicId,
                Name = c.Name,
                City = c.OfficialAddress.City,
                Country = c.OfficialAddress.Country,
                Zip = c.OfficialAddress.Zip,
                StreetName = c.OfficialAddress.StreetName,
                StreetNumber = c.OfficialAddress.StreetNumber
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);
        
        await SendAsync(data, cancellation: ct);
    }
}