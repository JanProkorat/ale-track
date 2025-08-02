using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;

namespace AleTrack.Features.Breweries.Commands.Create;

/// <summary>
/// Request to create new <see cref="Brewery"/>
/// </summary>
public sealed record CreateBreweryRequest
{
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public CreateBreweryDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint for creating a new <see cref="Brewery"/>.
/// </summary>
public sealed class CreateBreweryEndpoint(AleTrackDbContext dbContext) : Endpoint<CreateBreweryRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("breweries");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status201Created)
            .WithName(nameof(CreateBreweryEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates Brewery";
                s.Responses[StatusCodes.Status201Created] = "Brewery created";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateBreweryRequest req, CancellationToken ct)
    {
        var brewery = new Brewery
        {
            Name = req.Data.Name,
            OfficialAddress = new Address
            {
                StreetName = req.Data.OfficialAddress.StreetName,
                StreetNumber = req.Data.OfficialAddress.StreetNumber,
                City = req.Data.OfficialAddress.City,
                Country = req.Data.OfficialAddress.Country,
                Zip = req.Data.OfficialAddress.Zip
            },
            ContactAddress = req.Data.ContactAddress is not null ? new Address
            {
                StreetName = req.Data.ContactAddress.StreetName,
                StreetNumber = req.Data.ContactAddress.StreetNumber,
                City = req.Data.ContactAddress.City,
                Country = req.Data.ContactAddress.Country,
                Zip = req.Data.ContactAddress.Zip
            } : null
        };
        
        dbContext.Breweries.Add(brewery);
        await dbContext.SaveChangesAsync(ct);
        
        await SendAsync(brewery.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}