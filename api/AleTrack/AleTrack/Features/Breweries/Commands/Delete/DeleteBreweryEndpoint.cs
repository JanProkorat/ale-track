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
            .RequirePermission(ModuleType.Breweries, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .WithName(nameof(DeleteBreweryEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes Brewery";
                s.Responses[StatusCodes.Status204NoContent] = "Brewery deleted";
                s.Responses[StatusCodes.Status400BadRequest] = "Brewery still owns products";
            }
        );
    }
    
    /// <inheritdoc />
    public override async Task HandleAsync(DeleteBreweryRequest req, CancellationToken ct)
    {
        var brewery = await dbContext.Breweries.FirstOrDefaultAsync(c => c.PublicId == req.Id, ct);
        if (brewery == null)
            ThrowHelper.PublicEntityNotFound(nameof(brewery), req.Id);

        // Brewery -> Product is Cascade and order_items.product_id is Restrict, so deleting
        // a brewery that still owns products either destroys history (before the Restrict
        // change) or fails deep in the provider. Refuse it here with something readable.
        var productCount = await dbContext.Products.CountAsync(p => p.BreweryId == brewery!.Id, ct);
        if (productCount > 0)
            ThrowHelper.BreweryHasProducts(req.Id, productCount);

        dbContext.Breweries.Remove(brewery!);
        
        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}