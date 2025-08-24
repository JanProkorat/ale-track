using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Breweries.Queries.ProductList;

/// <summary>
/// Request model for retrieving a filtered list of products.
/// </summary>
/// <remarks>
/// This request is used to pass filtering and sorting parameters for querying the list of products.
/// It inherits properties from the <see cref="FilterableRequest"/> class to support query parameter functionality.
/// </remarks>
public record GetProductsListRequest : FilterableRequest
{
    /// <summary>
    /// ID of related brewery.
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint for retrieving a filtered list of Products.
/// </summary>
/// <remarks>
/// This endpoint is configured to respond to HTTP GET requests at the "Products" route.
/// It requires the user to have the "User" role and handles requests with filtering and sorting capabilities passed via query parameters.
/// </remarks>
/// <example>
/// The endpoint responds with a list of `BreweryListItemDto` objects, representing each brewery's identifier and name.
/// </example>
public sealed class GetBreweryProductsListEndpoint(AleTrackDbContext dbContext) : Endpoint<GetProductsListRequest, List<BreweryProductListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("breweries/{id}/products");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetBreweryProductsListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered products list";
            s.Responses[StatusCodes.Status200OK] = "List of products from given brewery";
        });
    }
    
    /// <inheritdoc />
    public override async Task HandleAsync(GetProductsListRequest req, CancellationToken ct)
    {
        var data = await dbContext.Products
            .Where(p => p.Brewery.PublicId == req.Id)
            .Select(c => new BreweryProductListItemDto
            {
                Id = c.PublicId,
                Name = c.Name,
                Description = c.Description,
                Kind = c.Kind,
                AlcoholPercentage = c.AlcoholPercentage,
                PlatoDegree = c.PlatoDegree,
                Type = c.Type,
                PackageSize = c.PackageSize,
                PriceForUnitWithoutVat = c.PriceForUnitWithoutVat,
                PriceForUnitWithVat = c.PriceForUnitWithVat,
                PriceWithVat = c.PriceWithVat
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);
        
        await SendAsync(data, cancellation: ct);
    }
}