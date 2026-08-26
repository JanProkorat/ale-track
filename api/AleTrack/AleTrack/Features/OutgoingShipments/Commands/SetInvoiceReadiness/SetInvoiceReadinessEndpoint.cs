using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.SetInvoiceReadiness;

/// <summary>
/// Whether one client's Fakturace row is finished.
/// </summary>
public sealed record SetInvoiceReadinessDto
{
    /// <summary>
    /// New value of the row's tick.
    /// </summary>
    public bool IsReady { get; set; }
}

/// <summary>
/// Request to mark one client's Fakturace row on a shipment as finished, or to un-mark it.
/// </summary>
public sealed record SetInvoiceReadinessRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Public ID of the client whose row is being marked — the payer of the row's invoices.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// The new tick value.
    /// </summary>
    [FromBody]
    public SetInvoiceReadinessDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint marking one client's invoice split on a run as finished, which is what puts it in the
/// export file and gives it its number.
/// </summary>
/// <remarks>
/// Marking hands out the next number on the run; un-marking keeps it, so re-marking is idempotent
/// and no number is ever printed against two clients. Both directions stay open while the run's
/// invoicing does — the flag is a marker, not a lock, so a mistake found after marking is fixed by
/// editing the split as usual.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="driverScope"></param>
public sealed class SetInvoiceReadinessEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope)
    : Endpoint<SetInvoiceReadinessRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}/invoices/clients/{ClientId:guid}/readiness");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .RequireCapability(Capability.Invoicing)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetInvoiceReadinessEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Marks one client's invoice split on a shipment as finished";
                s.Responses[StatusCodes.Status204NoContent] = "Readiness stored";
                s.Responses[StatusCodes.Status400BadRequest] = "Shipment invoicing can no longer be changed";
                s.Responses[StatusCodes.Status404NotFound] =
                    "Outgoing shipment not found, or the client has no row on its invoice split";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetInvoiceReadinessRequest req, CancellationToken ct)
    {
        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, req.Id, ct);

        var split = await ShipmentInvoiceGraph.LoadAsync(dbContext, req.Id, ct);
        if (split is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);
            return;
        }

        var shipment = split.Shipment;

        if (!ShipmentInvoiceGraph.IsEditable(shipment))
        {
            ThrowHelper.BadRequest($"Invoicing of a {shipment.State} shipment can no longer be changed.");
            return;
        }

        // Filed paperwork does not move. Past that point the marks are the record of what was
        // filed, and the deviations recorded since are what say how the delivery actually went.
        if (shipment.IsInvoicingFiled)
            ThrowHelper.ShipmentInvoicingFiled(req.Id);

        var client = await dbContext.Clients.FirstOrDefaultAsync(c => c.PublicId == req.ClientId, ct);

        // A client with no row of its own — a sub-client billed through its payer, or one not on the
        // run at all — reads as not found rather than being handed a number nothing prints.
        if (client is null || !ShipmentInvoiceGraph.RowClientIds(split).Contains(client.Id))
        {
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.ClientId);
            return;
        }

        var confirmation = shipment.InvoiceConfirmations.FirstOrDefault(c => c.ClientId == client.Id);

        if (confirmation is null)
        {
            // Clearing a row nobody ever marked is a no-op: opening a record for it would burn a
            // number on a row that was never confirmed.
            if (!req.Data.IsReady)
            {
                await Send.NoContentAsync(ct);
                return;
            }

            shipment.InvoiceConfirmations.Add(new OutgoingShipmentInvoiceConfirmation
            {
                PublicId = Guid.NewGuid(),
                OutgoingShipment = shipment,
                ClientId = client.Id,
                Client = client,
                Number = ShipmentInvoiceGraph.NextConfirmationNumber(shipment),
                IsReady = true
            });
        }
        else
        {
            // The number stays whatever it was — that is what makes re-marking give the same one
            // back.
            confirmation.IsReady = req.Data.IsReady;
        }

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
