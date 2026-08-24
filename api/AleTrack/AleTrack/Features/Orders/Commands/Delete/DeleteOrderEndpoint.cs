using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Features.Clients.Utils;
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
            .RequirePermission(ModuleType.Orders, PermissionLevel.Edit)
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

        // Before the removal, which the context turns into a state flip to Cancelled: a cancelled
        // order settles nothing, so every open point it promised to carry goes back to open.
        // Cancelling the *shipment* is a different thing entirely and must not do this — that only
        // frees the order for re-planning, and it still carries the debt.
        await ClientLedgerAssignment.ReleaseForCancelledOrderAsync(dbContext, order!.Id, ct);

        dbContext.Orders.Remove(order!);

        await dbContext.SaveChangesAsync(ct);
        await Send.ResponseAsync(null, StatusCodes.Status202Accepted, ct);
    }
}