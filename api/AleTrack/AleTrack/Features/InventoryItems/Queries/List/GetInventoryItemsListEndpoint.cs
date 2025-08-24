using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
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
/// Retrieves inventory items filtered by query parameters and returns a list of InventorySectionDto objects.
/// </example>
internal sealed class GetInventoryItemsListEndpoint(AleTrackDbContext dbContext) : Endpoint<FilterableRequest, List<InventorySectionDto>>
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
            .Where(i => i.Product != null)
            .GroupBy(i => new { i.Product!.Brewery.PublicId, i.Product!.Brewery.Name})
            .Select(g => new InventorySectionDto
            {
                Id = g.Key.PublicId,
                Name = g.Key.Name,
                Items = g.Select(i => new InventoryItemListItemDto
                {
                    Id = i.PublicId,
                    ProductId = i.Product != null ? i.Product.PublicId : null,
                    Name = i.Product != null ? i.Product.Name : i.Name,
                    Quantity = i.Quantity,
                    Kind = i.Product != null ? i.Product.Kind : null,
                    Type = i.Product != null ? i.Product.Type : null,
                    AlcoholPercentage = i.Product != null ? i.Product.AlcoholPercentage : null,
                    PackageSize = i.Product != null ? i.Product.PackageSize : null,
                    PlatoDegree = i.Product != null ? i.Product.PlatoDegree : null,
                    PriceWithVat = i.Product != null ? i.Product.PriceWithVat : null,
                    PriceForUnitWithoutVat = i.Product != null ? i.Product.PriceForUnitWithoutVat : null,
                    PriceForUnitWithVat = i.Product != null ? i.Product.PriceForUnitWithVat : null,
                })
                .ToList()
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);
        
        await SendAsync(data, cancellation: ct);
    }
}