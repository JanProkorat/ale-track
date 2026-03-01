using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reminders.Queries.List.OrderItems;

/// <summary>
/// Represents an API endpoint for retrieving list of reminders associated with a specific order items
/// </summary>
public sealed class GetOrderItemsRemindersListEndpoint(AleTrackDbContext dbContext) : EndpointWithoutRequest<List<ClientOrderReminderDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("order-items/reminders");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetOrderItemsRemindersListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets reminders list for all unfinished order items";
            s.Responses[StatusCodes.Status200OK] = "List of reminders";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var reminders = await dbContext.Orders
            .Where(o => o.State != OrderState.Cancelled 
                        && o.State != OrderState.Finished
                        && o.OrderItems.Any(i => i.ReminderState == OrderItemReminderState.Added))
            .SelectMany(o => o.OrderItems)
            .Where(i => i.ReminderState == OrderItemReminderState.Added)
            .GroupBy(i => new {i.Order.Client.PublicId, i.Order.Client.Name})
            .Select(g => new ClientOrderReminderDto
            {
                ClientId = g.Key.PublicId,
                ClientName = g.Key.Name,
                OrderItems = g
                    .OrderBy(r => r.Order.RequiredDeliveryDate)
                    .Select(i => new OrderItemReminderDto
                    {
                        OrderId = i.Order.PublicId,
                        ProductId = i.Product.PublicId,
                        ProductName = i.Product.Name,
                        PackageSize = i.Product.PackageSize,
                        Quantity = i.Quantity,
                        ClientName = i.Order.Client.Name,
                        DeliveryDate = i.Order.RequiredDeliveryDate
                    })
                    .ToList()
            })
            .ToListAsync(ct);
        
        await Send.ResponseAsync(reminders, cancellation: ct);
    }
}