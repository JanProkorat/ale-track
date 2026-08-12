using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.OutgoingShipments.Commands.AddInvoice;

/// <summary>
/// Which client to open another invoice for.
/// </summary>
public sealed record AddShipmentInvoiceDto
{
    /// <summary>
    /// Public ID of the client the new invoice is issued to.
    /// </summary>
    public Guid ClientId { get; set; }
}

/// <summary>
/// Request to add an invoice to an outgoing shipment.
/// </summary>
public sealed record AddShipmentInvoiceRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Which client to open the invoice for.
    /// </summary>
    [FromBody]
    public AddShipmentInvoiceDto Data { get; set; } = null!;
}

/// <summary>
/// Validator for <see cref="AddShipmentInvoiceRequest"/>.
/// </summary>
public sealed class AddShipmentInvoiceValidator : Validator<AddShipmentInvoiceRequest>
{
    public AddShipmentInvoiceValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data.ClientId).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
    }
}

/// <summary>
/// Endpoint opening an additional, empty invoice for a client on an outgoing shipment.
/// </summary>
/// <remarks>
/// The invoice starts with no lines — the user then moves pieces onto it. Reconciliation leaves
/// empty invoices alone as long as their client takes part in the shipment, so it survives until
/// it is either filled or deleted.
/// </remarks>
/// <param name="dbContext"></param>
public sealed class AddShipmentInvoiceEndpoint(AleTrackDbContext dbContext) : Endpoint<AddShipmentInvoiceRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("outgoing-shipments/{Id:guid}/invoices");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .RequireCapability(Capability.Invoicing)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(AddShipmentInvoiceEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Adds another invoice for a client on an outgoing shipment";
                s.Responses[StatusCodes.Status204NoContent] = "Invoice added";
                s.Responses[StatusCodes.Status400BadRequest] = "Shipment no longer editable";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment or client not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AddShipmentInvoiceRequest req, CancellationToken ct)
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

        var client = shipment.Stops.Where(s => s.ClientOrder is not null).Select(s => s.ClientOrder!.Client)
            .Concat(shipment.Invoices.Select(i => i.Client))
            .FirstOrDefault(c => c is not null && c.PublicId == req.Data.ClientId);

        // Only clients taking part in this shipment can be invoiced for it.
        if (client is null || !ShipmentInvoiceGraph.EligibleClientIds(shipment).Contains(client.Id))
        {
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.Data.ClientId);
            return;
        }

        shipment.Invoices.Add(new OutgoingShipmentInvoice
        {
            PublicId = Guid.NewGuid(),
            OutgoingShipment = shipment,
            ClientId = client.Id,
            Client = client,
            Sequence = ShipmentInvoiceReconciler.NextSequenceFor(shipment, client.Id)
        });

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
