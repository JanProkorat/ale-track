using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.InventoryItems.Queries.List;

/// <summary>
/// Endpoint for retrieving a filtered list of inventory items.
/// </summary>
/// <remarks>
/// This endpoint is responsible for handling HTTP GET requests to retrieve inventory items from the database.
/// It supports filtering and sorting operations using query parameters provided in the request.
/// </remarks>
/// <example>
/// Retrieves inventory items filtered by query parameters and returns a list of InventoryItemListItemDto objects.
/// </example>
internal sealed class GetInventoryItemsListEndpoint(AleTrackDbContext dbContext) : Endpoint<FilterableRequest, List<InventoryItemListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("inventory-items");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetInventoryItemsListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered inventory items list";
            s.Responses[StatusCodes.Status200OK] = "List of inventory items";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FilterableRequest req, CancellationToken ct)
    {
        var data = await dbContext.InventoryItems
            .Select(i => new InventoryItemListItemDto
            {
                Id = i.PublicId,
                ProductId = i.Product != null ? i.Product.PublicId : null,
                Name = i.Product != null ? i.Product.Name : i.Name,
                Amount = i.Amount
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);
        
        await SendAsync(data, cancellation: ct);
    }
}