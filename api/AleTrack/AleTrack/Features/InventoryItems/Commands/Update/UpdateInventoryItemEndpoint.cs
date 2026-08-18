using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.InventoryItems.Utils;
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
            .RequirePermission(ModuleType.Inventory, PermissionLevel.Edit)
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
        
        // A row booked in from a supplier stop keeps its goods: its identity is what lets the next
        // dovoz find it to increment. Quantity and note stay editable — a stock correction is the
        // point of this endpoint — but pointing it at a product instead would leave a row claiming
        // to be both, which the check constraint refuses. Said here as a 400 rather than let through
        // as a 500.
        if (inventoryItem!.SupplierGoodId is not null && req.Data.ProductId is not null)
            InventoryItemThrowHelper.SupplierGoodStockCannotBeRepointed(req.Id, req.Data.ProductId.Value);

        var product = await GetProductAsync(req.Data.ProductId, ct);

        inventoryItem.Product = product;
        inventoryItem.Name = req.Data.Name;
        inventoryItem.Quantity = req.Data.Quantity;
        inventoryItem.Note = req.Data.Note;

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
    
    private async Task<Product?> GetProductAsync(Guid? productId, CancellationToken cancellationToken)
    {
        if (productId is null)
            return null;
        
        var product = await dbContext.Products.FirstOrDefaultAsync(r => r.PublicId == productId && !r.IsDeleted, cancellationToken);
        if (product is null)
            ThrowHelper.PublicEntityNotFound(nameof(Product), productId.Value);

        return product!;
    }
}