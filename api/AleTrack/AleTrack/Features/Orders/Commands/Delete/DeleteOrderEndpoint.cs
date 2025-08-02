using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Orders.Commands.Delete;

/// <summary>
/// Request to delete given order
/// </summary>
public sealed record DeleteOrderRequest
{
    /// <summary>
    /// Public ID of the order
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint responsible for handling the deletion of an order.
/// </summary>
public sealed class DeleteOrderEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteOrderRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("orders/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteOrderEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes order for delivery";
                s.Responses[StatusCodes.Status202Accepted] = "Order deleted";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteOrderRequest req, CancellationToken ct)
    {
        var order = await dbContext.Orders.FirstOrDefaultAsync(o => o.PublicId == req.Id, ct);
        if (order == null)
            ThrowHelper.PublicEntityNotFound(nameof(Order), req.Id);

        order!.State = OrderState.Cancelled;
        
        await dbContext.SaveChangesAsync(ct);
        await SendAsync(null, StatusCodes.Status202Accepted, ct);
    }
}