using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Orders.Queries.List;

/// <summary>
/// Endpoint for retrieving a filtered list of orders.
/// </summary>
/// <remarks>
/// This endpoint receives a request containing query parameters and returns a list of filtered orders.
/// </remarks>
/// <example>
/// The endpoint URL is configured as "orders" and can only be accessed by users with the required role.
/// It supports sorting and filtering based on the provided parameters.
/// </example>
/// <param name="dbContext">
/// The database context that facilitates interaction with the database for querying orders.
/// </param>
public sealed class GetOrdersListEndpoint(AleTrackDbContext dbContext) : Endpoint<FilterableRequest, List<OrderListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("orders");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetOrdersListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered order list";
            s.Responses[StatusCodes.Status200OK] = "List of orders";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FilterableRequest req, CancellationToken ct)
    {
        var data = await dbContext.Orders
            .Select(o => new OrderListItemDto
            {
                State = o.State,
                ClientId = o.Client.PublicId,
                DeliveryDate = o.DeliveryDate
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);

        await SendOkAsync(data, cancellation: ct);
    }
}