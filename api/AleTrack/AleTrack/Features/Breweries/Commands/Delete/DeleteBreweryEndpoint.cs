using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Breweries.Commands.Delete;

/// <summary>
/// Request to delete <see cref="Brewery"/>
/// </summary>
public sealed record DeleteBreweryRequest
{
    /// <summary>
    /// Public ID of the Brewery
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to handle the deletion of a <see cref="Brewery"/>.
/// </summary>
public sealed class DeleteBreweryEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteBreweryRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("breweries/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status204NoContent)
            .WithName(nameof(DeleteBreweryEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes Brewery";
                s.Responses[StatusCodes.Status204NoContent] = "Brewery deleted";
            }
        );
    }
    
    /// <inheritdoc />
    public override async Task HandleAsync(DeleteBreweryRequest req, CancellationToken ct)
    {
        var brewery = await dbContext.Breweries.FirstOrDefaultAsync(c => c.PublicId == req.Id, ct);
        if (brewery == null)
            ThrowHelper.PublicEntityNotFound(nameof(brewery), req.Id);

        dbContext.Breweries.Remove(brewery!);
        
        await dbContext.SaveChangesAsync(ct);
        await SendNoContentAsync(ct);
    }
}