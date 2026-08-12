using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;

namespace AleTrack.Features.OutgoingShipments.Commands.DeletePurchaseInvoice;

/// <summary>
/// Request to delete one brewery invoice of an outgoing shipment.
/// </summary>
public sealed record DeletePurchaseInvoiceRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Public ID of the purchase invoice to delete.
    /// </summary>
    public Guid InvoiceId { get; set; }
}

/// <summary>
/// Endpoint deleting a brewery invoice of an outgoing shipment.
/// </summary>
/// <remarks>
/// No unwind logic: the invoice and its lines are dropped and the pieces they held fall back into
/// the remainder invoice, because the remainder is computed rather than stored.
///
/// Deleting the last line-holding invoice removes the remainder invoice with it — a split of one
/// is not a split, and leaving it behind would keep an empty column on screen. Sequences of the
/// surviving invoices are compacted so they stay 1..N.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="driverScope"></param>
public sealed class DeletePurchaseInvoiceEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope)
    : Endpoint<DeletePurchaseInvoiceRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("outgoing-shipments/{Id:guid}/purchase-invoices/{InvoiceId:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .RequireCapability(Capability.Invoicing)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeletePurchaseInvoiceEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes a brewery invoice of an outgoing shipment";
                s.Responses[StatusCodes.Status204NoContent] = "Invoice deleted, its pieces returned to the remainder";
                s.Responses[StatusCodes.Status400BadRequest] = "Shipment no longer editable, or this is the remainder invoice";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment or invoice not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeletePurchaseInvoiceRequest req, CancellationToken ct)
    {
        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, req.Id, ct);

        var shipment = await PurchaseInvoiceSplit.LoadAsync(dbContext, req.Id, ct);
        if (shipment is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);
            return;
        }

        if (!PurchaseInvoiceSplit.IsEditable(shipment))
        {
            ThrowHelper.BadRequest($"Purchase invoices of a {shipment.State} shipment can no longer be changed.");
            return;
        }

        var invoice = shipment.PurchaseInvoices.FirstOrDefault(i => i.PublicId == req.InvoiceId);
        if (invoice is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipmentPurchaseInvoice), req.InvoiceId);
            return;
        }

        if (invoice.Sequence == 1)
        {
            ThrowHelper.BadRequest("The remainder invoice cannot be deleted on its own.");
            return;
        }

        var removedSequence = invoice.Sequence;
        Remove(shipment, invoice);

        // One invoice left means nothing is split any more; drop the remainder too.
        if (shipment.PurchaseInvoices.Count == 1)
            Remove(shipment, shipment.PurchaseInvoices.First());

        var sequence = 1;
        foreach (var survivor in shipment.PurchaseInvoices.OrderBy(i => i.Sequence))
            survivor.Sequence = sequence++;

        CompactLoadingStates(shipment, removedSequence);

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Moves the loading states along with the columns they describe.
    /// </summary>
    /// <remarks>
    /// They are keyed by sequence, and the sequences above the deleted invoice have just shifted
    /// down — leaving them alone would show F3's "checked" against F2's pieces. The deleted
    /// column's own states go with it; the remainder column (1) never moves.
    /// </remarks>
    private void CompactLoadingStates(OutgoingShipment shipment, int removedSequence)
    {
        foreach (var state in shipment.LoadingStates.ToList())
        {
            if (state.Sequence == removedSequence)
            {
                shipment.LoadingStates.Remove(state);
                dbContext.OutgoingShipmentLoadingStates.Remove(state);
            }
            else if (state.Sequence > removedSequence)
            {
                state.Sequence -= 1;
            }
        }
    }

    private void Remove(OutgoingShipment shipment, OutgoingShipmentPurchaseInvoice invoice)
    {
        shipment.PurchaseInvoices.Remove(invoice);
        dbContext.OutgoingShipmentPurchaseInvoiceLines.RemoveRange(invoice.Lines);
        dbContext.OutgoingShipmentPurchaseInvoices.Remove(invoice);
    }
}
