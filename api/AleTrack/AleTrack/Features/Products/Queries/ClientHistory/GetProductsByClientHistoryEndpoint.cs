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
        // Get all products with their order counts in a single query
        // Pre-aggregate order counts for products for the given client
        var orderCountsByProduct = await dbContext.OrderItems
            .Where(oi => oi.Order.Client.PublicId == req.ClientId)
            .GroupBy(oi => oi.ProductId)
            .Select(g => new { ProductId = g.Key, OrderCount = g.Count() })
            .ToListAsync(ct);

        var productsWithOrderCounts = await dbContext.Products
            .Select(p => new
            {
                Product = p,
                OrderCount = orderCountsByProduct
                    .FirstOrDefault(x => x.ProductId == p.Id)?.OrderCount ?? 0
            })
            .Select(x => new
            {
                Dto = new ProductListItemDto
                {
                    Id = x.Product.PublicId,
                    Name = x.Product.Name,
                    Description = x.Product.Description,
                    Kind = x.Product.Kind,
                    AlcoholPercentage = x.Product.AlcoholPercentage,
                    PlatoDegree = x.Product.PlatoDegree,
                    Type = x.Product.Type,
                    PackageSize = x.Product.PackageSize,
                    PriceForUnitWithoutVat = x.Product.PriceForUnitWithoutVat,
                    PriceForUnitWithVat = x.Product.PriceForUnitWithVat,
                    PriceWithVat = x.Product.PriceWithVat,
                    Weight = x.Product.Weight,
                    BreweryId = x.Product.Brewery.PublicId,
                    BreweryName = x.Product.Brewery.Name
                },
                x.OrderCount
            })
            .ToListAsync(ct);
        
        // Apply filtering to the DTOs
        var filteredData = productsWithOrderCounts
            .Select(x => x.Dto)
            .AsQueryable()
            .ApplyFilterAndSort(req.Parameters)
            .ToList();
        
        // Create a lookup for order counts
        var orderCountLookup = productsWithOrderCounts.ToDictionary(
            x => x.Dto.Id, 
            x => x.OrderCount);
        
        // Order products by their order count (most ordered first), then by name
        var orderedData = filteredData
            .OrderByDescending(p => orderCountLookup.GetValueOrDefault(p.Id, 0))
            .ThenBy(p => p.Name)
            .ToList();

        
        // Recent = všechny produkty, které klient již někdy objednal (OrderCount > 0), seřazené dle frekvence a jména
        var recent = orderedData
            .Where(p => orderCountLookup.GetValueOrDefault(p.Id, 0) > 0)
            .ToList();
        
        // IDs of products in the recent section to exclude from breweries
        var recentProductIds = recent.Select(p => p.Id).ToHashSet();
        
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
