using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Breweries.Queries.Detail;

/// <summary>
/// Represents a request to retrieve details of a specific brewery.
/// </summary>
public sealed record GetBreweryDetailRequest
{
    /// <summary>
    /// ID of the brewery
    /// </summary>
    public Guid Id { get; set; }
}

public sealed class GetBreweryDetailEndpoint(AleTrackDbContext dbContext) : Endpoint<GetBreweryDetailRequest, BreweryDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("breweries/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(GetBreweryDetailEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets brewery detail";
            s.Responses[StatusCodes.Status200OK] = "Detail of brewery";
            s.SetNotFoundResponse("Brewery");
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetBreweryDetailRequest req, CancellationToken ct)
    {
        var breweries = await dbContext.Breweries
            .Where(c => c.PublicId == req.Id)
            .Select(c => new BreweryDto
            {
                Id = c.PublicId,
                Name = c.Name,
                OfficialAddress = new AddressDto
                {
                    City = c.OfficialAddress.City,
                    Country = c.OfficialAddress.Country,
                    Zip = c.OfficialAddress.Zip,
                    StreetName = c.OfficialAddress.StreetName,
                    StreetNumber = c.OfficialAddress.StreetNumber
                },
                ContactAddress = c.ContactAddress != null
                    ? new AddressDto
                    {
                        City = c.ContactAddress.City,
                        Country = c.ContactAddress.Country,
                        Zip = c.ContactAddress.Zip,
                        StreetName = c.ContactAddress.StreetName,
                        StreetNumber = c.ContactAddress.StreetNumber
                    }
                    : null
            })
            .FirstOrDefaultAsync(ct);

        if (breweries is null)
            ThrowHelper.PublicEntityNotFound(nameof(Brewery), req.Id);

        await SendOkAsync(breweries!, ct);
    }
}