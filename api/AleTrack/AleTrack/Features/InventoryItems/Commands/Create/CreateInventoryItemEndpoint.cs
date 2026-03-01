using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.InventoryItems.Commands.Create;

/// <summary>
/// Request model for creating a new inventory item.
/// </summary>
/// <remarks>
/// This record is used to encapsulate the data required to create a new inventory item.
/// It includes a property for transferring the inventory item details in the body of the request.
/// </remarks>
public sealed record CreateInventoryItemRequest
{
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public CreateInventoryItemDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint for creating a new inventory item by processing a request sent to the application.
/// </summary>
/// <remarks>
/// This class handles the creation of new inventory items, including validation of the request data,
/// ensuring the product exists, and checking for duplicate inventory items. If successful, it adds the
/// new inventory item to the database and returns its public identifier.
/// </remarks>
public sealed class CreateInventoryItemEndpoint(AleTrackDbContext dbContext) : Endpoint<CreateInventoryItemRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("inventory-items");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status201Created)
            .WithName(nameof(CreateInventoryItemEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates inventort item";
                s.Responses[StatusCodes.Status201Created] = "Item created";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateInventoryItemRequest req, CancellationToken ct)
    {
        var product = await GetProductAsync(req.Data.ProductId, ct);

        InventoryItem? inventoryItem;
        if (product is not null)
        {
            inventoryItem = await dbContext.InventoryItems.FirstOrDefaultAsync(i => i.ProductId != product.Id, ct);        
            if (inventoryItem is not null)
                ThrowHelper.EntityAlreadyExists(nameof(InventoryItem), inventoryItem.PublicId);
        }
        
        inventoryItem = new InventoryItem
        {
            Product = product,
            Note = req.Data.Note,
            Name = req.Data.Name,
            Quantity = req.Data.Quantity
        };
        
        dbContext.InventoryItems.Add(inventoryItem);
        await dbContext.SaveChangesAsync(ct);

        await SendAsync(inventoryItem.PublicId, cancellation: ct);
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