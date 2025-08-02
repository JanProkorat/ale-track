using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Products.Queries.Detail;


/// <summary>
/// Represents a request to retrieve details of a specific Product.
/// </summary>
public sealed record GetProductDetailRequest
{
    /// <summary>
    /// ID of the Product
    /// </summary>
    public Guid Id { get; set; }
}

public sealed class GetProductDetailEndpoint(AleTrackDbContext dbContext) : Endpoint<GetProductDetailRequest, ProductDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("products/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(GetProductDetailEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets product detail";
            s.Responses[StatusCodes.Status200OK] = "Detail of product";
            s.SetNotFoundResponse("Product");
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetProductDetailRequest req, CancellationToken ct)
    {
        var breweries = await dbContext.Products
            .Where(c => c.PublicId == req.Id)
            .Select(c => new ProductDto
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
            .FirstOrDefaultAsync(ct);

        if (breweries is null)
            ThrowHelper.PublicEntityNotFound(nameof(Product), req.Id);

        await SendOkAsync(breweries!, ct);
    }
}