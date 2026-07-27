using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Orders.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Order = AleTrack.Entities.Order;

namespace AleTrack.Features.Orders.Commands.Update;

/// <summary>
/// Request to update existing order
/// </summary>
public sealed record UpdateOrderRequest
{
    /// <summary>
    /// Public ID of the order
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public UpdateOrderDto Data { get; set; } = null!;
}

/// <summary>
/// API endpoint for updating an existing order for delivery.
/// </summary>
/// <remarks>
/// Processes an HTTP PUT request to update the specified order's delivery date and state.
/// </remarks>
public sealed class UpdateOrderEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateOrderRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("orders/{id}");
        Description(b => b
            .RequirePermission(ModuleType.Orders, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(UpdateOrderEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates order for delivery";
                s.Responses[StatusCodes.Status204NoContent] = "Order updated";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateOrderRequest req, CancellationToken ct)
    {
        var order = await dbContext.Orders
            .Where(o => o.PublicId == req.Id)
            .Include(o => o.Client)
            .Include(o => o.OrderItems)
            .Include(o => o.Returns)
            .Include(o => o.Notes)
            .Include(o => o.CustomExtraItems)
            .FirstOrDefaultAsync(ct);
        
        if (order is null)
            ThrowHelper.PublicEntityNotFound(nameof(Order), req.Id);

        if (req.Data.ClientId != order!.Client.PublicId)
        {
            var client = await dbContext.Clients.FirstOrDefaultAsync(c => c.PublicId == req.Data.ClientId, ct);
            if (client == null)
                ThrowHelper.PublicEntityNotFound(nameof(Client), req.Data.ClientId);
            
            order.Client = client!;
        }
        
        var products = await GetExistingProductsAsync(req.Data.OrderItems, ct);

        order.RequiredDeliveryDate = req.Data.RequiredDeliveryDate;
        order.ActualDeliveryDate = req.Data.ActualDeliveryDate;
        order.State = req.Data.State;

        var addressChanged = await OrderDeliveryAddressWriter.ApplyAsync(
            dbContext, order, order.Client, req.Data.DeliveryAddressKind, req.Data.ClientDeliveryPlaceId, ct);

        if (addressChanged)
            await OrderDeliveryAddressWriter.PropagateToStopAsync(dbContext, order, DateTime.UtcNow, ct);

        order.OrderItems.Clear();
        
        foreach (var orderItem in req.Data.OrderItems)
        {
            var relatedProduct = products.FirstOrDefault(p => p.PublicId == orderItem.ProductId);
            if (relatedProduct is null)
                ThrowHelper.PublicEntityNotFound(nameof(Product), orderItem.ProductId);

            order.OrderItems.Add(new OrderItem
            {
                Product = relatedProduct!,
                Quantity = orderItem.Quantity,
                ReminderState = orderItem.ReminderState
            });
        }
        
        order.Returns = GetReturns(req.Data.Returns, order);
        order.Notes = GetNotes(req.Data.Notes, order);
        order.CustomExtraItems = GetCustomExtras(req.Data.CustomExtraItems, order);

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Diffs the posted returns against the persisted ones: rows without an ID are
    /// new, rows matching a persisted <see cref="OrderReturn.PublicId"/> are updated
    /// in place (keeping their ID stable), and anything left out is dropped.
    /// </summary>
    private static List<OrderReturn> GetReturns(List<OrderReturnDto> returns, Order order)
    {
        var result = returns
            .Where(r => r.Id is null)
            .Select(r => new OrderReturn { Name = r.Name, Quantity = r.Quantity, Note = r.Note })
            .ToList();

        foreach (var r in returns.Where(r => r.Id is not null && order.Returns.Any(x => x.PublicId == r.Id!.Value)))
        {
            var existing = order.Returns.First(x => x.PublicId == r.Id!.Value);
            existing.Name = r.Name;
            existing.Quantity = r.Quantity;
            existing.Note = r.Note;
            result.Add(existing);
        }

        return result;
    }

    /// <summary>
    /// Diffs the posted notes against the persisted ones, the same way as returns.
    /// <see cref="OrderNote.DateCreated"/> is server-owned: kept as-is on an
    /// existing note, stamped now on a new one.
    /// </summary>
    private static List<OrderNote> GetNotes(List<OrderNoteDto> notes, Order order)
    {
        var result = notes
            .Where(n => n.Id is null)
            .Select(n => new OrderNote { Text = n.Text, DateCreated = DateTime.UtcNow })
            .ToList();

        foreach (var n in notes.Where(n => n.Id is not null && order.Notes.Any(x => x.PublicId == n.Id!.Value)))
        {
            var existing = order.Notes.First(x => x.PublicId == n.Id!.Value);
            existing.Text = n.Text;
            result.Add(existing);
        }

        return result;
    }

    /// <summary>
    /// Diffs posted custom extras against the persisted ones, like returns and notes.
    /// <see cref="OrderCustomExtraItem.IsShipmentLoadingConfirmed"/> is left alone —
    /// it belongs to the shipment, and an order edit must not un-confirm a loaded item.
    /// </summary>
    private static List<OrderCustomExtraItem> GetCustomExtras(List<OrderCustomExtraItemDto> extras, Order order)
    {
        var result = extras
            .Where(e => e.Id is null)
            .Select(e => new OrderCustomExtraItem { Description = e.Description, Quantity = e.Quantity })
            .ToList();

        foreach (var e in extras.Where(e => e.Id is not null && order.CustomExtraItems.Any(x => x.PublicId == e.Id!.Value)))
        {
            var existing = order.CustomExtraItems.First(x => x.PublicId == e.Id!.Value);
            existing.Description = e.Description;
            existing.Quantity = e.Quantity;
            result.Add(existing);
        }

        return result;
    }

    private async Task<List<Product>> GetExistingProductsAsync(List<UpdateOrderItemDto> orderItems, CancellationToken ct)
    {
        var productIds = orderItems
            .Select(i => i.ProductId)
            .ToList();

        return await dbContext.Products
            .Where(p => productIds.Contains(p.PublicId))
            .ToListAsync(ct);
    }
}