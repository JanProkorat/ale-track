using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Orders.Queries.Detail;

/// <summary>
/// Request to get detail of <see cref="Order"/>
/// </summary>
public sealed record GetOrderDetailRequest
{
    /// <summary>
    /// ID of related <see cref="Order"/>
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Represents an endpoint for retrieving the details of an <see cref="Order"/>.
/// </summary>
public sealed class GetOrderDetailEndpoint(AleTrackDbContext dbContext) : Endpoint<GetOrderDetailRequest, OrderDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("orders/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(GetOrderDetailEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets order detail";
            s.Responses[StatusCodes.Status200OK] = "Detail of an order";
            s.SetNotFoundResponse("Order");
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetOrderDetailRequest req, CancellationToken ct)
    {
        var order = await dbContext.Orders
            .Where(o => o.PublicId == req.Id)
            .Include(o => o.Client)
            .Select(o => new OrderDto
            {
                Id = o.PublicId,
                DeliveryDate = o.DeliveryDate,
                State = o.State,
                CreatedDate = o.CreatedDate,
                Client = new ClientInfo
                {
                    Id = o.Client.PublicId,
                    Name = o.Client.Name
                }
            })
            .FirstOrDefaultAsync(ct);
        
        if (order is null)
            ThrowHelper.PublicEntityNotFound(nameof(Order), req.Id);

        await SendAsync(order!, cancellation: ct);
    }
}