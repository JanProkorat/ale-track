using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Features.Products.Queries.List;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Products.Queries.ClientHistory;

/// <summary>
/// Request for retrieving products ordered by client's order history.
/// </summary>
public sealed record GetProductsByClientHistoryRequest : FilterableRequest
{
    /// <summary>
    /// Public ID of the client
    /// </summary>
    public Guid ClientId { get; set; }
}

/// <summary>
/// Endpoint for retrieving a filtered list of Products ordered by a client's order history.
/// </summary>
/// <remarks>
/// This endpoint is configured to respond to HTTP GET requests at the "products/client/{ClientId}/history" route.
/// It requires the user to have the "User" role and handles requests with filtering and sorting capabilities passed via query parameters.
/// Products that were ordered most frequently in the client's previous orders appear first in the list.
/// </remarks>
public sealed class GetProductsByClientHistoryEndpoint(AleTrackDbContext dbContext) : Endpoint<GetProductsByClientHistoryRequest, GroupedProductHistoryDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("products/client/{ClientId}/history");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetProductsByClientHistoryEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered products list ordered by client's order history";
            s.Responses[StatusCodes.Status200OK] = "List of products ordered by frequency in client's order history";
        });
    }
    
    /// <inheritdoc />
    public override async Task HandleAsync(GetProductsByClientHistoryRequest req, CancellationToken ct)
    {
        // Pre-aggregate order counts for products for the given client directly in the database
        var orderCountsByProductId = await dbContext.OrderItems
            .Where(oi => oi.Order.Client.PublicId == req.ClientId)
            .GroupBy(oi => oi.ProductId)
            .Select(g => new { ProductId = g.Key, OrderCount = g.Count() })
            .ToDictionaryAsync(x => x.ProductId, x => x.OrderCount, ct);

        // Project products to DTOs in a single server-side query
        var productsQuery = dbContext.Products
            .Select(p => new ProductListItemDto
            {
                Id = p.PublicId,
                Name = p.Name,
                Description = p.Description,
                Kind = p.Kind,
                AlcoholPercentage = p.AlcoholPercentage,
                PlatoDegree = p.PlatoDegree,
                Type = p.Type,
                PackageSize = p.PackageSize,
                PriceForUnitWithoutVat = p.PriceForUnitWithoutVat,
                PriceForUnitWithVat = p.PriceForUnitWithVat,
                PriceWithVat = p.PriceWithVat,
                Weight = p.Weight,
                BreweryId = p.Brewery.PublicId,
                BreweryName = p.Brewery.Name
            })
            .ApplyFilterAndSort(req.Parameters);

        var filteredData = await productsQuery.ToListAsync(ct);

        // Create lookup for order counts using product PublicId -> underlying product Id mapping is not available here,
        // so we assume that OrderItem.ProductId points to the same entity as Product.Id used in the aggregation above.
        // We need to load Product.Id with PublicId mapping to correctly map counts to DTOs.
        var productIdByPublicId = await dbContext.Products
            .Select(p => new { p.Id, p.PublicId })
            .ToDictionaryAsync(x => x.PublicId, x => x.Id, ct);

        var orderCountLookup = filteredData.ToDictionary(
            dto => dto.Id,
            dto => productIdByPublicId.TryGetValue(dto.Id, out var internalId) &&
                   orderCountsByProductId.TryGetValue(internalId, out var count)
                ? count
                : 0);

        // Order products by their order count (most ordered first), then by name
        var orderedData = filteredData
            .OrderByDescending(p => orderCountLookup.TryGetValue(p.Id, out var count) ? count : 0)
            .ThenBy(p => p.Name)
            .ToList();

        // Recent = všechny produkty, které klient již někdy objednal (OrderCount > 0), seřazené dle frekvence a jména
        var recent = orderedData
            .Where(p => orderCountLookup.TryGetValue(p.Id, out var count) && count > 0)
            .ToList();
        
        // IDs of products in the recent section to exclude from breweries
        var recentProductIds = recent
            .Select(p => p.Id)
            .ToHashSet();
        
        // Products that the client has never ordered remain in breweries
        var remainingProducts = orderedData
            .Where(p => !recentProductIds.Contains(p.Id))
            .ToList();

        var breweries = remainingProducts
            .GroupBy(p => new { p.BreweryId, p.BreweryName })
            .Select(b => new BreweryGroupDto
            {
                BreweryId = b.Key.BreweryId,
                BreweryName = b.Key.BreweryName,
                Kinds = b.GroupBy(x => x.Kind)
                    .Select(k => new KindGroupDto
                    {
                        Kind = k.Key,
                        PackageSizes = k.GroupBy(x => x.PackageSize)
                            .Select(ps => new PackageGroupDto
                            {
                                Size = ps.Key,
                                Items = ps.ToList()
                            })
                            .OrderBy(x => x.Size)
                            .ToList()
                    })
                    .OrderBy(x => x.Kind)
                    .ToList()
            })
            .OrderBy(x => x.BreweryName)
            .ToList();

        var response = new GroupedProductHistoryDto
        {
            Recent = recent,
            Breweries = breweries
        };

        await SendAsync(response, cancellation: ct);
    }
}
