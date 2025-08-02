using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Orders.Queries.ItemsList;

/// <summary>
/// Endpoint to retrieve a filtered list of order items
/// </summary>
public sealed class GetOrderItemsListEndpoint(AleTrackDbContext dbContext) : Endpoint<FilterableRequest, List<OrderItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("orders/items");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetOrderItemsListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered order items list";
            s.Responses[StatusCodes.Status200OK] = "List of items in one order";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FilterableRequest req, CancellationToken ct)
    {
        var data = await dbContext.OrderItems
            .Select(o => new OrderItemDto
            {
                Id = o.PublicId,
                OrderId = o.Order.PublicId,
                ProductId = o.Product.PublicId,
                ProductName = o.Product.Name,
                Amount = o.Amount
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);

        await SendOkAsync(data, cancellation: ct);
    }
}