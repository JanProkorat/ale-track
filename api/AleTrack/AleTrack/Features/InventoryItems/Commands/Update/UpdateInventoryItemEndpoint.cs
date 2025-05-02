using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.InventoryItems.Commands.Update;

/// <summary>
/// Represents a request to update an inventory item in the system.
/// </summary>
public sealed record UpdateInventoryItemRequest
{
    /// <summary>
    /// Gets or sets the unique identifier of the inventory item.
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public UpdateInventoryItemDto Data { get; set; } = null!;
}

public sealed class UpdateInventoryItemEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateInventoryItemRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("inventory-items/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status204NoContent)
            .WithName(nameof(UpdateInventoryItemEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates inventory item";
                s.Responses[StatusCodes.Status204NoContent] = "Inventory item Updated";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateInventoryItemRequest req, CancellationToken ct)
    {
        var inventoryItem = await dbContext.InventoryItems.FirstOrDefaultAsync(i => i.PublicId == req.Id, ct);
        if (inventoryItem is null)
            ThrowHelper.PublicEntityNotFound(nameof(InventoryItem), req.Id);
        
        var product = await GetProductAsync(req.Data.ProductId, ct);

        inventoryItem!.Product = product;
        inventoryItem.Name = req.Data.Name;
        inventoryItem.Amount = req.Data.Amount;
        inventoryItem.Note = req.Data.Note;

        await dbContext.SaveChangesAsync(ct);
        await SendNoContentAsync(ct);
    }
    
    private async Task<Product?> GetProductAsync(Guid? productId, CancellationToken cancellationToken)
    {
        if (productId is null)
            return null;
        
        var product = await dbContext.Products.FirstOrDefaultAsync(r => r.PublicId == productId, cancellationToken);
        if (product is null)
            ThrowHelper.PublicEntityNotFound(nameof(Product), productId.Value);

        return product!;
    }
}