using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.MoveInvoiceLine;

/// <summary>
/// Request to move pieces between two invoices of an outgoing shipment.
/// </summary>
public sealed record MoveInvoiceLineRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// What to move, and where.
    /// </summary>
    [FromBody]
    public MoveInvoiceLineDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint moving pieces of one shipment item from one invoice to another — including an
/// invoice belonging to a different client.
/// </summary>
/// <param name="dbContext"></param>
public sealed class MoveInvoiceLineEndpoint(AleTrackDbContext dbContext) : Endpoint<MoveInvoiceLineRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}/invoices/move");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(MoveInvoiceLineEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Moves pieces of a shipment item to another invoice";
                s.Responses[StatusCodes.Status204NoContent] = "Pieces moved";
                s.Responses[StatusCodes.Status400BadRequest] = "Shipment no longer editable, or the move does not fit";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment, invoice, item or client not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MoveInvoiceLineRequest req, CancellationToken ct)
    {
        var shipment = await ShipmentInvoiceGraph.LoadAsync(dbContext, req.Id, ct);
        if (shipment is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);
            return;
        }

        if (!ShipmentInvoiceGraph.IsEditable(shipment))
        {
            ThrowHelper.BadRequest($"Invoice split of a {shipment.State} shipment can no longer be changed.");
            return;
        }

        // Reconcile first so the move operates on a split that matches what is actually loaded.
        var reconcileResult = ShipmentInvoiceReconciler.Reconcile(shipment);
        RemoveDetached(reconcileResult);

        var from = shipment.Invoices.FirstOrDefault(i => i.PublicId == req.Data.FromInvoiceId);
        if (from is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipmentInvoice), req.Data.FromInvoiceId);
            return;
        }

        var sourceItemId = ShipmentInvoiceGraph.ResolveSourceItemId(shipment, req.Data.SourceKind, req.Data.SourceItemId);
        if (sourceItemId is null)
        {
            ThrowHelper.PublicEntityNotFound(req.Data.SourceKind.ToString(), req.Data.SourceItemId);
            return;
        }

        var sourceLine = from.Lines.FirstOrDefault(l =>
            l.SourceKind == req.Data.SourceKind && ShipmentInvoiceGraph.SourceItemIdOf(l) == sourceItemId.Value);

        if (sourceLine is null)
        {
            ThrowHelper.BadRequest("The item is not billed on the invoice the pieces should come off.");
            return;
        }

        // Capped against this one source, not against the product's total on the invoice.
        if (req.Data.Quantity > sourceLine.Quantity)
        {
            ThrowHelper.BadRequest(
                $"Only {sourceLine.Quantity} pieces of this item are billed on that invoice, cannot move {req.Data.Quantity}.");
            return;
        }

        var target = ResolveTarget(shipment, req.Data);
        if (target is null)
            return;

        if (target == from)
        {
            ThrowHelper.BadRequest("Source and target invoice are the same.");
            return;
        }

        var existing = target.Lines.FirstOrDefault(l =>
            l.SourceKind == req.Data.SourceKind && ShipmentInvoiceGraph.SourceItemIdOf(l) == sourceItemId.Value);

        if (existing is not null)
        {
            existing.Quantity += req.Data.Quantity;
        }
        else
        {
            var line = new OutgoingShipmentInvoiceLine
            {
                PublicId = Guid.NewGuid(),
                Quantity = req.Data.Quantity
            };
            ShipmentInvoiceGraph.AssignSource(line, req.Data.SourceKind, sourceItemId.Value);
            target.Lines.Add(line);
        }

        sourceLine.Quantity -= req.Data.Quantity;
        if (sourceLine.Quantity <= 0)
        {
            from.Lines.Remove(sourceLine);
            dbContext.OutgoingShipmentInvoiceLines.Remove(sourceLine);
        }

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// The invoice the pieces land on: an existing one, or a fresh one for the requested client.
    /// Returns null when it threw.
    /// </summary>
    private OutgoingShipmentInvoice? ResolveTarget(OutgoingShipment shipment, MoveInvoiceLineDto data)
    {
        if (data.ToInvoiceId is not null)
        {
            var target = shipment.Invoices.FirstOrDefault(i => i.PublicId == data.ToInvoiceId.Value);
            if (target is null)
                ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipmentInvoice), data.ToInvoiceId.Value);

            return target;
        }

        var client = shipment.Invoices.Select(i => i.Client)
            .Concat(shipment.Stops.Where(s => s.ClientOrder is not null).Select(s => s.ClientOrder!.Client))
            .Concat(shipment.ClientExtraItems.Select(e => e.Client))
            .Concat(shipment.CustomExtraItems.Select(e => e.Client))
            .FirstOrDefault(c => c is not null && c.PublicId == data.ToClientId!.Value);

        // Only clients that already take part in this shipment may be billed on it.
        if (client is null || !ShipmentInvoiceGraph.EligibleClientIds(shipment).Contains(client.Id))
        {
            ThrowHelper.PublicEntityNotFound(nameof(Client), data.ToClientId!.Value);
            return null;
        }

        var created = new OutgoingShipmentInvoice
        {
            PublicId = Guid.NewGuid(),
            OutgoingShipment = shipment,
            ClientId = client.Id,
            Client = client,
            Sequence = ShipmentInvoiceReconciler.NextSequenceFor(shipment, client.Id)
        };
        shipment.Invoices.Add(created);
        return created;
    }

    private void RemoveDetached(ReconcileResult result)
    {
        if (result.RemovedLines.Count > 0)
            dbContext.OutgoingShipmentInvoiceLines.RemoveRange(result.RemovedLines);

        if (result.RemovedInvoices.Count > 0)
            dbContext.OutgoingShipmentInvoices.RemoveRange(result.RemovedInvoices);
    }
}
