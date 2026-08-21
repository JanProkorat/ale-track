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
/// invoice belonging to a different client, or off invoicing altogether.
/// </summary>
/// <remarks>
/// Pieces marked private are still loaded and delivered; they simply appear on no invoice. They
/// are held as ordinary lines with no invoice, so the same cap, merge and cleanup rules apply in
/// both directions.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="driverScope"></param>
public sealed class MoveInvoiceLineEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope)
    : Endpoint<MoveInvoiceLineRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}/invoices/move");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .RequireCapability(Capability.Invoicing)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(MoveInvoiceLineEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Moves pieces of a shipment item to another invoice, or off invoicing";
                s.Responses[StatusCodes.Status204NoContent] = "Pieces moved";
                s.Responses[StatusCodes.Status400BadRequest] = "Shipment no longer editable, or the move does not fit";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment, invoice, item or client not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MoveInvoiceLineRequest req, CancellationToken ct)
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
            ThrowHelper.BadRequest($"Invoice split of a {shipment.State} shipment can no longer be changed.");
            return;
        }

        // Reconcile first so the move operates on a split that matches what is actually loaded.
        var reconcileResult = ShipmentInvoiceReconciler.Reconcile(split);
        RemoveDetached(reconcileResult);

        // A null FromInvoiceId means the pieces are being taken back out of the private ones.
        OutgoingShipmentInvoice? from = null;
        if (req.Data.FromInvoiceId is not null)
        {
            from = shipment.Invoices.FirstOrDefault(i => i.PublicId == req.Data.FromInvoiceId.Value);
            if (from is null)
            {
                ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipmentInvoice), req.Data.FromInvoiceId.Value);
                return;
            }
        }

        var sourceItemId = ShipmentInvoiceGraph.ResolveSourceItemId(shipment, req.Data.SourceKind, req.Data.SourceItemId);
        if (sourceItemId is null)
        {
            ThrowHelper.PublicEntityNotFound(req.Data.SourceKind.ToString(), req.Data.SourceItemId);
            return;
        }

        var origin = from is null ? split.PrivateLines : (ICollection<OutgoingShipmentInvoiceLine>)from.Lines;
        var sourceLine = LineOf(origin, req.Data.SourceKind, sourceItemId.Value);

        if (sourceLine is null)
        {
            ThrowHelper.BadRequest(from is null
                ? "The item has no pieces excluded from invoicing to take back."
                : "The item is not billed on the invoice the pieces should come off.");
            return;
        }

        // Capped against this one source, not against the product's total on the invoice.
        if (req.Data.Quantity > sourceLine.Quantity)
        {
            ThrowHelper.BadRequest(
                $"Only {sourceLine.Quantity} pieces of this item are billed on that invoice, cannot move {req.Data.Quantity}.");
            return;
        }

        OutgoingShipmentInvoice? targetInvoice = null;
        if (!req.Data.ToPrivate)
        {
            targetInvoice = ResolveTarget(shipment, req.Data);
            if (targetInvoice is null)
                return;
        }

        if (targetInvoice == from)
        {
            ThrowHelper.BadRequest(from is null
                ? "These pieces are already excluded from invoicing."
                : "Source and target invoice are the same.");
            return;
        }

        var target = targetInvoice is null
            ? split.PrivateLines
            : (ICollection<OutgoingShipmentInvoiceLine>)targetInvoice.Lines;

        var existing = LineOf(target, req.Data.SourceKind, sourceItemId.Value);

        if (existing is not null)
        {
            existing.Quantity += req.Data.Quantity;
        }
        else
        {
            var line = new OutgoingShipmentInvoiceLine
            {
                PublicId = Guid.NewGuid(),
                OutgoingShipmentId = shipment.Id,
                IsPrivate = targetInvoice is null,
                Quantity = req.Data.Quantity
            };
            ShipmentInvoiceGraph.AssignSource(line, req.Data.SourceKind, sourceItemId.Value);
            target.Add(line);

            // A private line hangs off no navigation EF walks, so it has to be added explicitly.
            if (targetInvoice is null)
                dbContext.OutgoingShipmentInvoiceLines.Add(line);
        }

        sourceLine.Quantity -= req.Data.Quantity;
        if (sourceLine.Quantity <= 0)
        {
            origin.Remove(sourceLine);
            dbContext.OutgoingShipmentInvoiceLines.Remove(sourceLine);
        }

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// The line billing a given source item within one bucket — an invoice's lines, or the
    /// shipment's private lines.
    /// </summary>
    private static OutgoingShipmentInvoiceLine? LineOf(
        IEnumerable<OutgoingShipmentInvoiceLine> lines, InvoiceLineSourceKind kind, long sourceItemId) =>
        lines.FirstOrDefault(l => l.SourceKind == kind && ShipmentInvoiceGraph.SourceItemIdOf(l) == sourceItemId);

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

        if (result.RemovedRecipients.Count > 0)
            dbContext.OutgoingShipmentInvoiceBillingRecipients.RemoveRange(result.RemovedRecipients);
    }
}
