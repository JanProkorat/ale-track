using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.OutgoingShipments.Commands.UpdatePurchaseInvoice;

/// <summary>
/// Editable data of a brewery invoice.
/// </summary>
public sealed record UpdatePurchaseInvoiceDto
{
    /// <summary>
    /// The brewery's own invoice number, or null to clear it.
    /// </summary>
    public string? Label { get; set; }
}

/// <summary>
/// Request to update a brewery invoice of an outgoing shipment.
/// </summary>
public sealed record UpdatePurchaseInvoiceRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Public ID of the purchase invoice.
    /// </summary>
    public Guid InvoiceId { get; set; }

    /// <summary>
    /// New data of the invoice.
    /// </summary>
    [FromBody]
    public UpdatePurchaseInvoiceDto Data { get; set; } = null!;
}

/// <summary>
/// Validator for <see cref="UpdatePurchaseInvoiceRequest"/>.
/// </summary>
public sealed class UpdatePurchaseInvoiceValidator : Validator<UpdatePurchaseInvoiceRequest>
{
    public UpdatePurchaseInvoiceValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.InvoiceId).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data.Label)
            .MaximumLength(30)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}

/// <summary>
/// Endpoint setting the label of a brewery invoice — its real number, as printed on the document
/// the brewery hands us.
/// </summary>
/// <param name="dbContext"></param>
public sealed class UpdatePurchaseInvoiceEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdatePurchaseInvoiceRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Patch("outgoing-shipments/{Id:guid}/purchase-invoices/{InvoiceId:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(UpdatePurchaseInvoiceEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Sets the label of a brewery invoice";
                s.Responses[StatusCodes.Status204NoContent] = "Label stored";
                s.Responses[StatusCodes.Status400BadRequest] = "Shipment no longer editable";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment or invoice not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdatePurchaseInvoiceRequest req, CancellationToken ct)
    {
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

        var label = req.Data.Label?.Trim();
        invoice.Label = string.IsNullOrEmpty(label) ? null : label;

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
