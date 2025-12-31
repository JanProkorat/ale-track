using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

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
        var lastDisplayOrder = await dbContext.Breweries
            .OrderByDescending(c => c.DisplayOrder)
            .Select(c => c.DisplayOrder)
            .FirstOrDefaultAsync(ct);
        
        var brewery = new Brewery
        {
            DisplayOrder = lastDisplayOrder + 1,
            Color = req.Data.Color,
            Name = req.Data.Name,
            OfficialAddress = req.Data.OfficialAddress.ToDbEntity(),
            ContactAddress = req.Data.ContactAddress?.ToDbEntity()
        };
        
        dbContext.Breweries.Add(brewery);
        await dbContext.SaveChangesAsync(ct);
        
        await SendAsync(brewery.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}