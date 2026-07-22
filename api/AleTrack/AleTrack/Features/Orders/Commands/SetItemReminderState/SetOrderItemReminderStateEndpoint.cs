using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Orders.Commands.SetItemReminderState;

/// <summary>
/// Body carrying the new reminder state for an order item (null = not watched).
/// </summary>
public sealed record SetOrderItemReminderStateDto
{
    /// <summary>
    /// Target reminder state. Null clears the reminder ("not watched").
    /// </summary>
    public OrderItemReminderState? ReminderState { get; set; }
}

/// <summary>
/// Request to set a single order item's reminder state.
/// </summary>
public sealed record SetOrderItemReminderStateRequest
{
    /// <summary>
    /// Public ID of the order item.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Body of the request.
    /// </summary>
    [FromBody]
    public SetOrderItemReminderStateDto Data { get; set; } = null!;
}

/// <summary>
/// Sets (or clears) the reminder state of a single order item. Dedicated to the
/// "watch/resolve" workflow so it doesn't run the full order-update validation
/// (which, e.g., forbids past delivery dates).
/// </summary>
public sealed class SetOrderItemReminderStateEndpoint(AleTrackDbContext dbContext) : Endpoint<SetOrderItemReminderStateRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("order-items/{id}/reminder-state");
        Description(b => b
            .RequirePermission(ModuleType.Orders, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetOrderItemReminderStateEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Sets an order item's reminder state";
            s.Responses[StatusCodes.Status202Accepted] = "Reminder state updated";
            s.Responses[StatusCodes.Status404NotFound] = "Order item not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetOrderItemReminderStateRequest req, CancellationToken ct)
    {
        var item = await dbContext.OrderItems.FirstOrDefaultAsync(i => i.PublicId == req.Id, ct);

        if (item is null)
            ThrowHelper.PublicEntityNotFound(nameof(OrderItem), req.Id);

        item!.ReminderState = req.Data.ReminderState;
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(null, StatusCodes.Status202Accepted, ct);
    }
}
