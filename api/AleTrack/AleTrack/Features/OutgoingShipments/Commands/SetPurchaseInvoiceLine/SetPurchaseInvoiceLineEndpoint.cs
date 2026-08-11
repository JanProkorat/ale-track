using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.SetPurchaseInvoiceLine;

/// <summary>
/// How many pieces of one product sit on one of the shipment's brewery invoices.
/// </summary>
public sealed record SetPurchaseInvoiceLineDto
{
    /// <summary>
    /// Which invoice, by position within the shipment. Never 1 — that one is the remainder.
    /// </summary>
    public int Sequence { get; set; }

    /// <summary>
    /// Public ID of the product.
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Number of pieces. Zero removes the line.
    /// </summary>
    public int Quantity { get; set; }
}

/// <summary>
/// Request to set one product's quantity on a brewery invoice.
/// </summary>
public sealed record SetPurchaseInvoiceLineRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Invoice, product and quantity to store.
    /// </summary>
    [FromBody]
    public SetPurchaseInvoiceLineDto Data { get; set; } = null!;
}

/// <summary>
/// Validator for <see cref="SetPurchaseInvoiceLineRequest"/>.
/// </summary>
public sealed class SetPurchaseInvoiceLineValidator : Validator<SetPurchaseInvoiceLineRequest>
{
    public SetPurchaseInvoiceLineValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data.ProductId).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data.Sequence)
            .GreaterThanOrEqualTo(2)
            .WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
        RuleFor(r => r.Data.Quantity)
            .GreaterThanOrEqualTo(0)
            .WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
    }
}

/// <summary>
/// Endpoint setting how many pieces of a product sit on one brewery invoice.
/// </summary>
/// <remarks>
/// The invoice is addressed by <see cref="SetPurchaseInvoiceLineDto.Sequence"/>, not by ID, and
/// missing invoices up to it are created here. The nakládka shows two invoice columns from the
/// start, so the second one usually has nothing behind it until the first number is typed into
/// it; materialising on write keeps runs that never split free of empty rows, and keeps the
/// client from having to create an invoice and then write to it in two round trips.
///
/// Sequence 1 is rejected: it is the remainder, holding whatever the others do not, and storing
/// lines on it would give the same pieces two homes.
///
/// The quantity is clamped to what the run buys of that product minus the other invoices'
/// claims, so the remainder can never be driven negative by a too-large entry.
/// </remarks>
/// <param name="dbContext"></param>
public sealed class SetPurchaseInvoiceLineEndpoint(AleTrackDbContext dbContext) : Endpoint<SetPurchaseInvoiceLineRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}/purchase-invoices/lines");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .RequireCapability(Capability.Invoicing)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetPurchaseInvoiceLineEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Sets a product's quantity on a brewery invoice";
                s.Responses[StatusCodes.Status204NoContent] = "Quantity stored";
                s.Responses[StatusCodes.Status400BadRequest] = "Shipment no longer editable, or the remainder invoice was targeted";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment or product not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetPurchaseInvoiceLineRequest req, CancellationToken ct)
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

        if (req.Data.Sequence < 2)
        {
            ThrowHelper.BadRequest("The remainder invoice holds what the others do not; it cannot be written to.");
            return;
        }

        // No !IsDeleted filter, deliberately: this resolves a product the shipment
        // already carries. Retiring a product must not break splitting a run's
        // purchase invoices.
        var product = await dbContext.Products
            .FirstOrDefaultAsync(p => p.PublicId == req.Data.ProductId, ct);

        if (product is null || !PurchaseInvoiceSplit.PurchasedByProduct(shipment).ContainsKey(product.Id))
        {
            ThrowHelper.PublicEntityNotFound(nameof(Product), req.Data.ProductId);
            return;
        }

        var invoice = PurchaseInvoiceSplit.EnsureSequence(shipment, req.Data.Sequence);

        var quantity = Math.Min(req.Data.Quantity, PurchaseInvoiceSplit.CapFor(shipment, invoice, product.Id));
        var line = invoice.Lines.FirstOrDefault(l => l.ProductId == product.Id);

        if (quantity <= 0)
        {
            if (line is not null)
            {
                invoice.Lines.Remove(line);
                dbContext.OutgoingShipmentPurchaseInvoiceLines.Remove(line);
            }
        }
        else if (line is null)
        {
            invoice.Lines.Add(new OutgoingShipmentPurchaseInvoiceLine
            {
                PublicId = Guid.NewGuid(),
                PurchaseInvoice = invoice,
                ProductId = product.Id,
                Quantity = quantity
            });
        }
        else
        {
            line.Quantity = quantity;
        }

        var removed = PurchaseInvoiceSplit.Clamp(shipment);
        if (removed.Count > 0)
            dbContext.OutgoingShipmentPurchaseInvoiceLines.RemoveRange(removed);

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
