using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Clients.Utils;
using AleTrack.Features.Orders.Utils;
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
            .RequirePermission(ModuleType.Orders, PermissionLevel.Edit)
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
            RequiredDeliveryDate = req.Data.RequiredDeliveryDate
        };

        foreach (var note in req.Data.Notes)
        {
            order.Notes.Add(new OrderNote { Text = note.Text, DateCreated = DateTime.UtcNow });
        }

        foreach (var orderItem in req.Data.OrderItems)
        {
            var relatedProduct = products.FirstOrDefault(p => p.PublicId == orderItem.ProductId);
            if (relatedProduct is null)
                ThrowHelper.PublicEntityNotFound(nameof(Product), orderItem.ProductId);

            order.OrderItems.Add(new OrderItem
            {
                Product = relatedProduct!,
                Quantity = orderItem.Quantity,
                ReminderState = orderItem.ReminderState,
                LineKind = orderItem.LineKind,
                Note = orderItem.Note
            });
        }
        
        foreach (var orderReturn in req.Data.Returns)
        {
            order.Returns.Add(new OrderReturn
            {
                Name = orderReturn.Name,
                Quantity = orderReturn.Quantity,
                Note = orderReturn.Note
            });
        }

        foreach (var extra in req.Data.CustomExtraItems)
        {
            order.CustomExtraItems.Add(new OrderCustomExtraItem
            {
                Description = extra.Description,
                Quantity = extra.Quantity,
                Note = extra.Note
            });
        }

        var supplierGoods = await GetExistingSupplierGoodsAsync(req.Data.SupplierGoodItems, ct);

        foreach (var item in req.Data.SupplierGoodItems)
        {
            var relatedGood = supplierGoods.FirstOrDefault(g => g.PublicId == item.SupplierGoodId);
            if (relatedGood is null)
                ThrowHelper.PublicEntityNotFound(nameof(SupplierGood), item.SupplierGoodId);

            order.SupplierGoodItems.Add(new OrderSupplierGoodItem
            {
                SupplierGood = relatedGood!,
                Quantity = item.Quantity,
                Note = item.Note,
                LineKind = item.LineKind,
                // The good's standing default; a shipment can move pieces either way later.
                QuantityFromGarage = SupplierGoodSourcing.DefaultFromGarage(relatedGood!, item.Quantity)
            });
        }

        await OrderDeliveryAddressWriter.ApplyAsync(
            dbContext, order, client!, req.Data.DeliveryAddressKind, req.Data.ClientDeliveryPlaceId, ct);

        client!.Orders.Add(order);

        // The open points this order promises to settle. The order has no key yet, so the link is
        // made through the navigation and EF fills the column in the same save.
        await ClientLedgerAssignment.AssignAsync(dbContext, order, req.Data.SettledLedgerEntryIds, ct);

        await dbContext.SaveChangesAsync(ct);
        await Send.ResponseAsync(order.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }

    private async Task<List<Product>> GetExistingProductsAsync(List<CreateOrderItemDto> orderItems, CancellationToken ct)
    {
        var productIds = orderItems
            .Select(i => i.ProductId)
            .ToList();

        // Retired products are excluded, so ordering one reports it as not found — a
        // product taken off the price list must not enter a new order.
        return await dbContext.Products
            .Where(p => productIds.Contains(p.PublicId) && !p.IsDeleted)
            .ToListAsync(ct);
    }

    private async Task<List<SupplierGood>> GetExistingSupplierGoodsAsync(
        List<OrderSupplierGoodItemDto> items, CancellationToken ct)
    {
        var goodIds = items
            .Select(i => i.SupplierGoodId)
            .ToList();

        return await dbContext.SupplierGoods
            .Where(g => goodIds.Contains(g.PublicId))
            .ToListAsync(ct);
    }
}