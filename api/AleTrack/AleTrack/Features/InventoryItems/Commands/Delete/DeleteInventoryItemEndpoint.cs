using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.InventoryItems.Commands.Delete;

/// <summary>
/// Represents a request to delete an inventory item.
/// </summary>
public sealed record DeleteInventoryItemRequest
{
    /// <summary>
    /// Gets or sets the unique identifier of the inventory item.
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Defines an endpoint for deleting an inventory item.
/// </summary>
public sealed class DeleteInventoryItemEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteInventoryItemRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("inventory-items/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .WithName(nameof(DeleteInventoryItemEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes inventory item";
                s.Responses[StatusCodes.Status202Accepted] = "Inventory item deleted";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteInventoryItemRequest req, CancellationToken ct)
    {
        var inventoryItem = await dbContext.InventoryItems.FirstOrDefaultAsync(i => i.PublicId == req.Id, ct);
        if (inventoryItem is null)
            ThrowHelper.PublicEntityNotFound(nameof(InventoryItem), req.Id);

        dbContext.InventoryItems.Remove(inventoryItem!);
        await dbContext.SaveChangesAsync(ct);
        await SendAsync(null, StatusCodes.Status202Accepted, ct);
    }
}