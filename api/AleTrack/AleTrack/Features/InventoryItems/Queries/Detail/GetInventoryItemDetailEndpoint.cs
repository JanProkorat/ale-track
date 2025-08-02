using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.InventoryItems.Queries.Detail;

/// <summary>
/// Represents a request to retrieve detailed information about a specific inventory item.
/// </summary>
public sealed record GetInventoryItemDetailRequest
{
    /// <summary>
    /// ID of the item
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Defines the endpoint responsible for handling requests to retrieve detailed information about a specific inventory item.
/// </summary>
public sealed class GetInventoryItemDetailEndpoint(AleTrackDbContext dbContext) : Endpoint<GetInventoryItemDetailRequest, InventoryItemDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("inventory-items/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(GetInventoryItemDetailEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets inventory item detail";
            s.Responses[StatusCodes.Status200OK] = "Detail of inventory item";
            s.SetNotFoundResponse("Inventory item");
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetInventoryItemDetailRequest req, CancellationToken ct)
    {
        var item = await dbContext.InventoryItems
            .Where(i => i.PublicId == req.Id)
            .Select(i => new InventoryItemDto
            {
                Id = i.PublicId,
                ProductId = i.Product != null ? i.Product.PublicId : null,
                Name = i.Product != null ? i.Product.Name : i.Name,
                Amount = i.Amount,
                Note = i.Note
            })
            .FirstOrDefaultAsync(ct);
        
        if (item is null)
            ThrowHelper.PublicEntityNotFound(nameof(InventoryItem), req.Id);

        await SendOkAsync(item!, ct);
    }
}