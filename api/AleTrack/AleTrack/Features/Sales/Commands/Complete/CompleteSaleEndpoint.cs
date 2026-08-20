using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Sales.Commands.Complete;

/// <summary>
/// Endpoint completing a garage sale — the point at which the sold pieces leave the warehouse.
/// </summary>
/// <remarks>
/// This is the only path other than an outgoing shipment that decreases
/// <see cref="InventoryItem.Quantity"/>, and it is a command of its own rather than a state field on
/// the update payload because it is not an edit: it moves stock, it cannot be undone in this
/// version, and it has a failure mode (insufficient stock) that a general update has no business
/// returning.
///
/// Deliberately <see cref="EndpointWithoutRequest"/> rather than a request DTO holding just the route
/// ID: on POST, FastEndpoints binds a request DTO from the body and answers 415 when the caller sends
/// none — which the generated client does, because a route-only DTO produces no request body in the
/// OpenAPI document. Nothing about completing a sale needs a body. Same reasoning as
/// <c>AcknowledgeAddressChangesEndpoint</c> and <c>AddPurchaseInvoiceEndpoint</c>.
/// </remarks>
internal sealed class CompleteSaleEndpoint(AleTrackDbContext dbContext, TimeProvider timeProvider)
    : EndpointWithoutRequest
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("sales/{id:guid}/complete");
        Description(b => b
            .RequirePermission(ModuleType.Sales, PermissionLevel.Edit)
            .WithName(nameof(CompleteSaleEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status204NoContent));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Hands over a garage sale, deducting the sold pieces from inventory";
            s.Responses[StatusCodes.Status204NoContent] =
                "Sale completed (cash) or moved to awaiting payment (invoice); stock deducted either way";
            s.Responses[StatusCodes.Status404NotFound] = "Sale not found";
            s.Responses[StatusCodes.Status409Conflict] =
                "Sale is already completed, has an unpriced line, or exceeds available stock";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var saleId = Route<Guid>("id");

        // Tracked deliberately — the stock rows reached through Items are about to be mutated,
        // which is the one documented exception to the AsNoTracking rule for reads.
        var sale = await dbContext.Sales
            .Include(s => s.Items)
            .ThenInclude(i => i.InventoryItem)
            .FirstOrDefaultAsync(s => s.PublicId == saleId, ct);

        if (sale is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Sale), saleId);
        }

        if (sale!.State != SaleState.Draft)
        {
            ThrowHelper.SaleAlreadyCompleted(sale.PublicId);
        }

        if (sale.Items.Any(i => i.UnitPriceWithVat <= 0m))
        {
            ThrowHelper.SaleLinePriceMissing(sale.PublicId);
        }

        // Every line is checked before any is applied: a half-deducted sale is a worse outcome
        // than a refused one, and there is no storno in this version to repair it with.
        var insufficientLines = sale.Items
            .Where(i => i.InventoryItem is null || i.Quantity > i.InventoryItem.Quantity)
            .Select(i => i.Name)
            .ToList();

        if (insufficientLines.Count > 0)
        {
            ThrowHelper.SaleInsufficientStock(insufficientLines);
        }

        foreach (var item in sale.Items)
        {
            // Stock rows that reach zero are kept, not removed: an out-of-stock product must stay
            // visible in Sklad, and historical lines still point at the row.
            item.InventoryItem!.Quantity -= item.Quantity;
        }

        // The goods leave the counter either way, so the stock above moves either way. What differs
        // is whether the sale is *finished*: an invoice is still owed, so it waits for the money
        // instead of going straight to Completed.
        sale.State = sale.Payment == SalePaymentMethod.Invoice
            ? SaleState.AwaitingPayment
            : SaleState.Completed;
        sale.CompletedAt = timeProvider.GetUtcNow();

        // One SaveChanges covers the state flip and every decrement, so a sale can never be
        // recorded as completed while the stock stayed where it was.
        await dbContext.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
