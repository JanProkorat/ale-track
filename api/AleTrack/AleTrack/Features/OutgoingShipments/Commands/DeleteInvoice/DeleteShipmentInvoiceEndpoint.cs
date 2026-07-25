using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;

namespace AleTrack.Features.OutgoingShipments.Commands.DeleteInvoice;

/// <summary>
/// Request to delete one invoice of an outgoing shipment.
/// </summary>
public sealed record DeleteShipmentInvoiceRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Public ID of the invoice to delete.
    /// </summary>
    public Guid InvoiceId { get; set; }
}

/// <summary>
/// Endpoint deleting an additional invoice of an outgoing shipment.
/// </summary>
/// <remarks>
/// No unwind logic: the invoice and its lines are dropped, then reconciliation puts the pieces
/// back on the first invoice of whoever ordered them. That is the whole reason reconciliation
/// exists as a separate step.
///
/// A client's first invoice cannot be deleted — every client receiving goods needs somewhere to
/// be billed, and reconciliation would immediately recreate it.
/// </remarks>
/// <param name="dbContext"></param>
public sealed class DeleteShipmentInvoiceEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteShipmentInvoiceRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("outgoing-shipments/{Id:guid}/invoices/{InvoiceId:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteShipmentInvoiceEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes an additional invoice of an outgoing shipment";
                s.Responses[StatusCodes.Status204NoContent] = "Invoice deleted, its pieces returned to the ordering client";
                s.Responses[StatusCodes.Status400BadRequest] = "Shipment no longer editable, or this is the client's first invoice";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment or invoice not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteShipmentInvoiceRequest req, CancellationToken ct)
    {
        var split = await ShipmentInvoiceGraph.LoadAsync(dbContext, req.Id, ct);
        if (split is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);
            return;
        }

        var shipment = split.Shipment;

        if (!ShipmentInvoiceGraph.IsEditable(shipment))
        {
            ThrowHelper.BadRequest($"Invoice split of a {shipment.State} shipment can no longer be changed.");
            return;
        }

        var invoice = shipment.Invoices.FirstOrDefault(i => i.PublicId == req.InvoiceId);
        if (invoice is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipmentInvoice), req.InvoiceId);
            return;
        }

        var isFirstForClient = shipment.Invoices
            .Where(i => i.ClientId == invoice.ClientId)
            .All(i => i.Sequence >= invoice.Sequence);

        if (isFirstForClient)
        {
            ThrowHelper.BadRequest("A client's first invoice cannot be deleted.");
            return;
        }

        shipment.Invoices.Remove(invoice);
        dbContext.OutgoingShipmentInvoiceLines.RemoveRange(invoice.Lines);
        dbContext.OutgoingShipmentInvoices.Remove(invoice);

        // Reconciliation returns the pieces the invoice held to their ordering client. Private
        // pieces are untouched — they hang off the shipment, not off any invoice.
        var reconcileResult = ShipmentInvoiceReconciler.Reconcile(split);

        if (reconcileResult.RemovedLines.Count > 0)
            dbContext.OutgoingShipmentInvoiceLines.RemoveRange(reconcileResult.RemovedLines);

        if (reconcileResult.RemovedInvoices.Count > 0)
            dbContext.OutgoingShipmentInvoices.RemoveRange(reconcileResult.RemovedInvoices);

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
