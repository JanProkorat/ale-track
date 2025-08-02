using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Products.Commands.Ceate;

/// <summary>
/// Request to add multiple products to a brewery
/// </summary>
public sealed record CreateProductsRequest
{
    /// <summary>
    /// ID of the brewery to which products should be added
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public CreateProductsDto Data { get; set; } = null!;
}

public sealed class CreateProductsEndpoint(AleTrackDbContext dbContext) : Endpoint<CreateProductsRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("breweries/{id}/products");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status201Created)
            .WithName(nameof(CreateProductsEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates products in the brewery";
                s.Responses[StatusCodes.Status201Created] = "Brewery products created";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateProductsRequest req, CancellationToken ct)
    {
        var brewery = await dbContext.Breweries
            .Where(b => b.PublicId == req.Id)
            .Include(b => b.Products)
            .FirstOrDefaultAsync(ct);
        
        if (brewery is null)
            ThrowHelper.PublicEntityNotFound(nameof(Brewery), req.Id);

        foreach (var product in req.Data.Products)
        {
            brewery!.Products.Add(new Product
            {
                Name = product.Name,
                Description = product.Description,
                Type = product.Type,
                Kind = product.Kind,
                PackageSize = product.PackageSize,
                PriceForUnitWithoutVat = product.PriceForUnitWithoutVat,
                PriceForUnitWithVat = product.PriceForUnitWithVat,
                PriceWithVat = product.PriceWithVat,
                AlcoholPercentage = product.AlcoholPercentage,
                PlatoDegree = product.PlatoDegree
            });
        }
        
        await dbContext.SaveChangesAsync(ct);
        await SendAsync("", statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}