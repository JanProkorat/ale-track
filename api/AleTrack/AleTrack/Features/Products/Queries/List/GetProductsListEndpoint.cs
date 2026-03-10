using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Products.Queries.List;

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
public sealed class GetProductsListEndpoint(AleTrackDbContext dbContext) : Endpoint<FilterableRequest, List<ProductListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("products");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetProductsListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered products list";
            s.Responses[StatusCodes.Status200OK] = "List of products";
        });
    }
    
    /// <inheritdoc />
    public override async Task HandleAsync(FilterableRequest req, CancellationToken ct)
    {
        var data = await dbContext.Products
            .OrderBy(c => c.Brewery.DisplayOrder)
            .Select(c => new ProductListItemDto
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
                PriceWithVat = c.PriceWithVat,
                Weight = c.Weight,
                BreweryId = c.Brewery.PublicId,
                BreweryName = c.Brewery.Name,
                BreweryDisplayOrder = c.Brewery.DisplayOrder,
                DisplayOrder = c.DisplayOrder
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);
        
        await Send.OkAsync(data, cancellation: ct);
    }
}