using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Order = FastEndpoints.Order;

namespace AleTrack.Features.Orders.Commands.SetOrderItems;

/// <summary>
/// Request to set items for given <see cref="FastEndpoints.Order"/>
/// </summary>
public sealed record SetOrderItemsRequest
{
    /// <summary>
    /// ID of related <see cref="Entities.Order"/>
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public SetOrderItemsDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint for setting items on an existing order for delivery.
/// </summary>
public sealed class SetOrderItemsEndpoint(AleTrackDbContext dbContext) : Endpoint<SetOrderItemsRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("orders/{id}/items");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetOrderItemsEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Sets items to existing order for delivery";
                s.Responses[StatusCodes.Status202Accepted] = "Order updated - items set";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetOrderItemsRequest req, CancellationToken ct)
    {
        var order = await dbContext.Orders
            .Where(o => o.PublicId == req.Id)
            .Include(o => o.OrderItems)
            .FirstOrDefaultAsync(ct);
        
        if (order is null)
            ThrowHelper.PublicEntityNotFound(nameof(Order), req.Id);
        
        dbContext.OrderItems.RemoveRange(order!.OrderItems);
        order.OrderItems.Clear();
        
        var products = await GetExistingProductsAsync(req.Data.OrderItems, ct);
        
        foreach (var orderItem in req.Data.OrderItems)
        {
            var relatedProduct = products.FirstOrDefault(p => p.PublicId == orderItem.ProductId);
            if (relatedProduct is null)
                ThrowHelper.PublicEntityNotFound(nameof(Product), orderItem.ProductId);
        
            order.OrderItems.Add(new OrderItem
            {
                Product = relatedProduct!,
                Amount = orderItem.Quantity
            });
        }
        
        await dbContext.SaveChangesAsync(ct);
        await SendAsync(null, StatusCodes.Status202Accepted, ct);
    }
    
    private async Task<List<Product>> GetExistingProductsAsync(List<OrderItemDto> orderItems, CancellationToken ct)
    {
        var productIds = orderItems
            .Select(i => i.ProductId)
            .ToList();

        return await dbContext.Products
            .Where(p => productIds.Contains(p.PublicId))
            .ToListAsync(ct);
    }
}