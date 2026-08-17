using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.SetState;

/// <summary>
/// The state a shipment is being moved to.
/// </summary>
public sealed record SetShipmentStateDto
{
    /// <summary>
    /// New state of the shipment.
    /// </summary>
    public OutgoingShipmentState State { get; set; }
}

/// <summary>
/// Request to move an outgoing shipment to a new state.
/// </summary>
public sealed record SetShipmentStateRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The new state.
    /// </summary>
    [FromBody]
    public SetShipmentStateDto Data { get; set; } = null!;
}

/// <summary>
/// Validator for <see cref="SetShipmentStateRequest"/>.
/// </summary>
public sealed class SetShipmentStateValidator : Validator<SetShipmentStateRequest>
{
    public SetShipmentStateValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data.State).IsInEnum().WithErrorCode(ErrorCodes.ValidationEnumError);
    }
}

/// <summary>
/// Endpoint moving an outgoing shipment to a new state.
/// </summary>
/// <remarks>
/// Its own endpoint rather than a field on the full shipment PUT. Advancing a run used to mean
/// re-posting the whole thing — every stop, order line, via point, purchase and checklist step —
/// which the server then diffed against the stored run, rebuilt and re-linked before it got round
/// to the one field that had actually changed. On a remote database that is seconds of work for a
/// button that changes an enum.
///
/// The transition itself is not free — orders follow the run, stock moves, prices are snapshotted —
/// but all of it is driven from what is already stored. Nothing about the run needs to be sent, and
/// nothing that was not asked for is rewritten. The consequences live in
/// <see cref="ShipmentStateTransition"/>, shared with the full PUT so the two cannot drift.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="driverScope"></param>
public sealed class SetShipmentStateEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope)
    : Endpoint<SetShipmentStateRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}/state");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetShipmentStateEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Moves an outgoing shipment to a new state";
                s.Responses[StatusCodes.Status204NoContent] = "State changed";
                s.Responses[StatusCodes.Status400BadRequest] = "Illegal transition, or the run is not ready for it";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetShipmentStateRequest req, CancellationToken ct)
    {
        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, req.Id, ct);

        // Only what the transition itself touches: the orders riding along and their items, the
        // stock those items draw, the purchases booked in on delivery, and the snapshot rows the
        // Loaded boundary writes or clears. Deliberately none of the route, address or invoice
        // graph the full PUT has to load in order to diff it.
        var shipment = await dbContext.OutgoingShipments
            .Include(os => os.Drivers)
            .Include(os => os.Stops)
                .ThenInclude(s => s.ClientOrder!)
                    .ThenInclude(o => o.Client)
            .Include(os => os.Stops)
                .ThenInclude(s => s.ClientOrder!)
                    .ThenInclude(o => o.OrderItems)
                        .ThenInclude(oi => oi.Product)
                            .ThenInclude(p => p.Brewery)
            .Include(os => os.Stops)
                .ThenInclude(s => s.ClientOrder!)
                    .ThenInclude(o => o.OrderItems)
                        .ThenInclude(oi => oi.InventoryItem)
            .Include(os => os.Stops)
                .ThenInclude(s => s.ClientOrder!)
                    .ThenInclude(o => o.CustomExtraItems)
            .Include(os => os.Stops)
                .ThenInclude(s => s.Items)
            .Include(os => os.StockPurchases)
                .ThenInclude(sp => sp.Product)
            .FirstOrDefaultAsync(os => os.PublicId == req.Id, ct);

        if (shipment is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);
            return;
        }

        ShipmentStateTransition.EnsureAllowed(shipment, req.Data.State);
        ShipmentStateTransition.EnsureReady(shipment, req.Data.State);

        await ShipmentStateTransition.ApplyAsync(dbContext, shipment, req.Data.State, ct);

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
