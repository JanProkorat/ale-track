using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Order = AleTrack.Entities.Order;

namespace AleTrack.Features.Orders.Commands.Create;

/// <summary>
/// Request to create new <see cref="Entities.Order"/>
/// </summary>
public sealed record CreateOrderRequest
{
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public CreateOrderDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint responsible for handling the creation of new orders.
/// </summary>
public sealed class CreateOrderEndpoint(AleTrackDbContext dbContext) : Endpoint<CreateOrderRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("orders");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status201Created)
            .WithName(nameof(CreateOrderEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates order for delivery";
                s.Responses[StatusCodes.Status201Created] = "Order created";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateOrderRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients.FirstOrDefaultAsync(c => c.PublicId == req.Data.ClientId, ct);
        if (client == null)
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.Data.ClientId);

        var products = await GetExistingProductsAsync(req.Data.OrderItems, ct);

        var order = new Order
        {
            Client = client!,
            State = OrderState.New,
            CreatedDate = DateTime.UtcNow,
            DeliveryDate = req.Data.DeliveryDate
        };

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
        
        client!.Orders.Add(order);

        await dbContext.SaveChangesAsync(ct);
        await SendAsync(order.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }

    private async Task<List<Product>> GetExistingProductsAsync(List<CreateOrderItemDto> orderItems, CancellationToken ct)
    {
        var productIds = orderItems
            .Select(i => i.ProductId)
            .ToList();

        return await dbContext.Products
            .Where(p => productIds.Contains(p.PublicId))
            .ToListAsync(ct);
    }
}