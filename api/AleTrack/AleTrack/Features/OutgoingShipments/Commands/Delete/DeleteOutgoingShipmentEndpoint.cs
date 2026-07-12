using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.Delete;

/// <summary>
/// Request to delete an outgoing shipment
/// </summary>
public sealed record DeleteOutgoingShipmentRequest
{
    /// <summary>
    /// ID of the outgoing shipment to be deleted
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint responsible for handling the deletion of an outgoing shipment.
/// </summary>
/// <param name="dbContext"></param>
public sealed class DeleteOutgoingShipmentEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteOutgoingShipmentRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("outgoing-shipments/{Id:guid}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteOutgoingShipmentEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes an existing outgoing shipment";
                s.Responses[StatusCodes.Status202Accepted] = "Outgoing shipment deleted";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteOutgoingShipmentRequest req, CancellationToken ct)
    {
        var outgoingShipment = await dbContext.OutgoingShipments
            .Include(os => os.Stops)
                .ThenInclude(s => s.ClientOrder)
                    .ThenInclude(o => o.OrderItems)
            .FirstOrDefaultAsync(os => os.PublicId == req.Id, ct);

        if (outgoingShipment is null)
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);

        switch (outgoingShipment.State)
        {
            case OutgoingShipmentState.Delivered:
                ThrowHelper.ShipmentAlreadyDeliveredCannotBeDeleted(req.Id);
                break;
            case OutgoingShipmentState.Cancelled:
                ThrowHelper.ShipmentAlreadyCancelled(req.Id);
                break;
        }

        foreach (var stop in outgoingShipment.Stops)
        {
            foreach (var orderItem in stop.ClientOrder.OrderItems)
            {
                orderItem.FirstInvoiceQuantity = null;
                orderItem.SecondInvoiceQuantity = null;
                orderItem.IsShipmentLoadingConfirmed = false;
            }
        }

        dbContext.OutgoingShipments.Remove(outgoingShipment);
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(null, StatusCodes.Status202Accepted, ct);
    }
}