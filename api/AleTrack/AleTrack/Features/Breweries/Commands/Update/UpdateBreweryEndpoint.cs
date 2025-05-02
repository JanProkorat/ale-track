using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Breweries.Commands.Update;


/// <summary>
/// Request to update <see cref="Brewery"/>
/// </summary>
public sealed record UpdateBreweryRequest
{
    /// <summary>
    /// Public ID of the Brewery
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public UpdateBreweryDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint to handle the update operation for a <see cref="Brewery"/> entity.
/// </summary>
public sealed class UpdateBreweryEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateBreweryRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("breweries/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status204NoContent)
            .WithName(nameof(UpdateBreweryEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates Brewery";
                s.Responses[StatusCodes.Status204NoContent] = "Brewery Updated";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateBreweryRequest req, CancellationToken ct)
    {
        var brewery = await dbContext.Breweries.FirstOrDefaultAsync(c => c.PublicId == req.Id, ct);
        if (brewery == null)
            ThrowHelper.PublicEntityNotFound(nameof(brewery), req.Id);

        brewery!.Name = req.Data.Name;
        brewery.StreetName = req.Data.Address.StreetName;
        brewery.StreetNumber = req.Data.Address.StreetNumber;
        brewery.City = req.Data.Address.City;
        brewery.Zip = req.Data.Address.Zip;
        brewery.Country = req.Data.Address.Country;
        
        await dbContext.SaveChangesAsync(ct);
        await SendNoContentAsync(ct);
    }
}