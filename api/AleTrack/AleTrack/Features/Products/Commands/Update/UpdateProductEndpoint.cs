using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Products.Commands.Update;

/// <summary>
/// Represents the request object for updating product details.
/// </summary>
public sealed record UpdateProductRequest
{
    /// <summary>
    /// ID of the product
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public UpdateProductDto Data { get; set; } = null!;
}

/// <summary>
/// Represents an endpoint for updating product details.
/// </summary>
public sealed class UpdateProductEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateProductRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("products/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status204NoContent)
            .WithName(nameof(UpdateProductEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates product";
                s.Responses[StatusCodes.Status204NoContent] = "Product Updated";
                s.SetNotFoundResponse("Product");
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateProductRequest req, CancellationToken ct)
    {
        var product = await dbContext.Products.FirstOrDefaultAsync(p => p.PublicId == req.Id, ct);
        if (product is null)
            ThrowHelper.PublicEntityNotFound(nameof(Product), req.Id);
        
        product!.Name = req.Data.Name;
        product.Price = req.Data.Price;
        product.Description = req.Data.Description;

        await dbContext.SaveChangesAsync(ct);
        await SendNoContentAsync(ct);
    }
}