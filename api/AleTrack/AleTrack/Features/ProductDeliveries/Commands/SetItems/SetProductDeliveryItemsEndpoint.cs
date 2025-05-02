using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ProductDeliveries.Commands.SetItems;

/// <summary>
/// Represents a request to set or update product delivery items.
/// </summary>
/// <remarks>
/// This request includes an identifier and associated data required to update or set the product delivery information.
/// The data contains detailed delivery item records encapsulated in a nested DTO structure.
/// </remarks>
public sealed record SetProductDeliveryItemsRequest
{
    /// <summary>
    /// ID of related delivery
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public SetProductDeliveryItemsDto Data { get; set; } = null!;
}

public sealed class SetProductDeliveryItemsEndpoint(AleTrackDbContext dbContext) : Endpoint<SetProductDeliveryItemsRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("products/deliveries/{id}/items");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetProductDeliveryItemsEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Sets items to existing product delivery";
                s.Responses[StatusCodes.Status202Accepted] = "Delivery updated - items set";
                s.SetNotFoundResponse("Delivery");
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetProductDeliveryItemsRequest req, CancellationToken ct)
    {
        var delivery = await dbContext.ProductDeliveries
            .Where(d => d.PublicId == req.Id)
            .Include(d => d.Items)
            .FirstOrDefaultAsync(ct);
        
        if (delivery is null)
            ThrowHelper.PublicEntityNotFound(nameof(ProductDelivery), req.Id);
        
        var newItems = await GetDeliveryItemsAsync(req.Data.Items, ct);
        
        delivery!.Items.Clear();

        foreach (var item in newItems)
            delivery.Items.Add(item);
        
        await dbContext.SaveChangesAsync(ct);
        await SendAsync(null, StatusCodes.Status202Accepted, ct);
    }
    
    private async Task<List<DeliveryItem>> GetDeliveryItemsAsync(List<ProductDeliveryItemsDto> products, CancellationToken cancellationToken)
    {
        if (products.Count == 0)
            return [];
        
        var productIds = products
            .Select(p => p.ProductId)
            .Distinct()
            .ToList();

        var existingProducts = await dbContext.Products
            .Where(p => productIds.Contains(p.PublicId))
            .ToListAsync(cancellationToken);

        if (existingProducts.Count < productIds.Count)
        {
            var foundProductIds = existingProducts.Select(d => d.PublicId).ToList();
            var nonExistingProductIds = productIds.Except(foundProductIds).ToList();
        
            ThrowHelper.PublicEntitiesNotFound(nameof(Product), nonExistingProductIds);
        }
        
        var deliveryItems = new List<DeliveryItem>();
        foreach (var requestProduct in products)
        {
            var relatedProduct = existingProducts.First(p => p.PublicId == requestProduct.ProductId);
            
            deliveryItems.Add(new DeliveryItem
            {
                Product = relatedProduct,
                Amount = requestProduct.Quantity,
                Note = requestProduct.Note
            });
        }
        
        return deliveryItems;
    }
}