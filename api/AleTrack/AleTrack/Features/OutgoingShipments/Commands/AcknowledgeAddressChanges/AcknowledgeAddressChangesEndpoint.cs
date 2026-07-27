using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.AcknowledgeAddressChanges;

/// <summary>
/// Request to dismiss the delivery-address-change notice on a shipment
/// </summary>
public sealed record AcknowledgeAddressChangesRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Clears the pending delivery-address-change stamp on every stop of a
/// shipment — the "Rozumím" action behind the banner. Separate from the
/// shipment update because the read-only detail screen must be able to dismiss
/// the notice without saving the whole shipment.
/// </summary>
public sealed class AcknowledgeAddressChangesEndpoint(AleTrackDbContext dbContext)
    : Endpoint<AcknowledgeAddressChangesRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("outgoing-shipments/{Id:guid}/acknowledge-address-changes");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(AcknowledgeAddressChangesEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Dismisses the delivery-address-change notice on a shipment";
            s.Responses[StatusCodes.Status204NoContent] = "Notice dismissed";
            s.SetNotFoundResponse("OutgoingShipment");
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AcknowledgeAddressChangesRequest req, CancellationToken ct)
    {
        var shipment = await dbContext.OutgoingShipments
            .Include(s => s.Stops)
            .FirstOrDefaultAsync(s => s.PublicId == req.Id, ct);

        if (shipment is null)
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);

        foreach (var stop in shipment!.Stops)
            stop.AddressChangedAt = null;

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
