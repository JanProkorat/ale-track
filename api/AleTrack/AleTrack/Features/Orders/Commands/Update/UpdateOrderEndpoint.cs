using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
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
            .RequireRole(UserRoleType.User)
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
        var order = await dbContext.Orders.FirstOrDefaultAsync(o => o.PublicId == req.Id, ct);
        if (order is null)
            ThrowHelper.PublicEntityNotFound(nameof(Order), req.Id);

        order!.DeliveryDate = req.Data.DeliveryDate;
        order.State = req.Data.State;
        
        await dbContext.SaveChangesAsync(ct);
        await SendNoContentAsync(ct);
    }
}