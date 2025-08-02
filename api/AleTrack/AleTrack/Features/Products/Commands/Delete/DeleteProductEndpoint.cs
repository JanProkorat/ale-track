using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Products.Commands.Delete;

/// <summary>
/// Represents a request to delete a product.
/// </summary>
public sealed record DeleteProductRequest
{
    /// <summary>
    /// ID of the product
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Handles the deletion of a product in the system.
/// Provides API endpoint configuration and logic for deleting a product by its identifier.
/// </summary>
public sealed class DeleteProductEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteProductRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("products/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteProductEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes product";
                s.Responses[StatusCodes.Status202Accepted] = "Product deleted";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteProductRequest req, CancellationToken ct)
    {
        var product = await dbContext.Products.FirstOrDefaultAsync(o => o.PublicId == req.Id, ct);
        if (product == null)
            ThrowHelper.PublicEntityNotFound(nameof(Order), req.Id);

        dbContext.Products.Remove(product!);
        await dbContext.SaveChangesAsync(ct);
        
        await SendAsync(null, StatusCodes.Status202Accepted, ct);
    }
}