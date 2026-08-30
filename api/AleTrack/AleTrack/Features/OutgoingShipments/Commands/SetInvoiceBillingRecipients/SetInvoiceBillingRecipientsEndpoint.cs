using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.SetInvoiceBillingRecipients;

/// <summary>
/// Request to set which sub-clients one invoice names as addresses to invoice.
/// </summary>
public sealed record SetInvoiceBillingRecipientsRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Public ID of the invoice.
    /// </summary>
    public Guid InvoiceId { get; set; }

    /// <summary>
    /// The full selection.
    /// </summary>
    [FromBody]
    public SetInvoiceBillingRecipientsDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint replacing the set of sub-clients named on a payer's invoice.
/// </summary>
/// <remarks>
/// The office picks them so the payer knows which of its sub-clients to raise its own invoices
/// against. Any sub-client of the payer may be named, whether or not it has goods on this
/// shipment — a payer may owe an address for something billed elsewhere.
///
/// Each row takes a copy of the client's official address here; reconciliation keeps that copy in
/// step until the run stops being invoicing-editable, after which it is history.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="driverScope"></param>
public sealed class SetInvoiceBillingRecipientsEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope)
    : Endpoint<SetInvoiceBillingRecipientsRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}/invoices/{InvoiceId:guid}/billing-recipients");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .RequireCapability(Capability.Invoicing)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetInvoiceBillingRecipientsEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Sets which sub-clients an invoice names as addresses to invoice";
                s.Responses[StatusCodes.Status204NoContent] = "Selection saved";
                s.Responses[StatusCodes.Status400BadRequest] =
                    "Shipment no longer editable, a client is not billed through this payer, or it has no official address";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment, invoice or client not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetInvoiceBillingRecipientsRequest req, CancellationToken ct)
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

        ShipmentInvoiceGraph.EnsureInvoicingNotFiled(shipment);

        var invoice = shipment.Invoices.FirstOrDefault(i => i.PublicId == req.InvoiceId);
        if (invoice is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipmentInvoice), req.InvoiceId);
            return;
        }

        var requestedIds = req.Data.ClientIds;
        List<Client> clients = requestedIds.Count == 0
            ? []
            : await dbContext.Clients.Where(c => requestedIds.Contains(c.PublicId)).ToListAsync(ct);

        var missing = requestedIds.Where(id => clients.All(c => c.PublicId != id)).ToList();
        if (missing.Count > 0)
        {
            ThrowHelper.PublicEntitiesNotFound(nameof(Client), missing);
            return;
        }

        foreach (var client in clients)
        {
            // The selection exists to tell the payer whom to bill on, so it only makes sense for
            // clients this very invoice pays for.
            if (client.InvoicingClientId != invoice.ClientId)
            {
                ThrowHelper.BadRequest($"Client '{client.Name}' is not billed through this invoice's client.");
                return;
            }

            if (client.OfficialAddress is null)
            {
                ThrowHelper.BadRequest($"Client '{client.Name}' has no official address to show.");
                return;
            }
        }

        var keptIds = clients.Select(c => c.Id).ToHashSet();

        var dropped = invoice.BillingRecipients.Where(r => !keptIds.Contains(r.ClientId)).ToList();
        foreach (var recipient in dropped)
            invoice.BillingRecipients.Remove(recipient);

        if (dropped.Count > 0)
            dbContext.OutgoingShipmentInvoiceBillingRecipients.RemoveRange(dropped);

        foreach (var client in clients)
        {
            var existing = invoice.BillingRecipients.FirstOrDefault(r => r.ClientId == client.Id);
            if (existing is not null)
            {
                existing.Address = client.OfficialAddress!.Copy();
                continue;
            }

            invoice.BillingRecipients.Add(new OutgoingShipmentInvoiceBillingRecipient
            {
                PublicId = Guid.NewGuid(),
                Invoice = invoice,
                ClientId = client.Id,
                Client = client,
                Address = client.OfficialAddress!.Copy()
            });
        }

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
