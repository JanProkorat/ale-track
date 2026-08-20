using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Sales.Commands.ConfirmPayment;

/// <summary>
/// Endpoint confirming that an invoiced sale has been paid, finishing it.
/// </summary>
/// <remarks>
/// The counterpart to completing a sale: completion hands over the goods and deducts the stock, this
/// records that the money arrived. It touches no inventory — the pieces left the shelf when the sale
/// was handed over, not when it was settled.
///
/// Deliberately <see cref="EndpointWithoutRequest"/>: on POST, a route-only request DTO makes
/// FastEndpoints bind from the body and answer 415 when the caller sends none, which the generated
/// client does. Same reasoning as <c>CompleteSaleEndpoint</c> and
/// <c>AcknowledgeAddressChangesEndpoint</c>.
/// </remarks>
internal sealed class ConfirmSalePaymentEndpoint(AleTrackDbContext dbContext, TimeProvider timeProvider)
    : EndpointWithoutRequest
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("sales/{id:guid}/confirm-payment");
        Description(b => b
            .RequirePermission(ModuleType.Sales, PermissionLevel.Edit)
            .WithName(nameof(ConfirmSalePaymentEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status204NoContent));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Confirms an invoiced sale has been paid and finishes it";
            s.Responses[StatusCodes.Status204NoContent] = "Payment recorded, sale completed";
            s.Responses[StatusCodes.Status404NotFound] = "Sale not found";
            s.Responses[StatusCodes.Status409Conflict] = "Sale is not awaiting payment";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var saleId = Route<Guid>("id");

        var sale = await dbContext.Sales.FirstOrDefaultAsync(s => s.PublicId == saleId, ct);

        if (sale is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Sale), saleId);
        }

        // Guards both directions: a draft has not been handed over yet, and an already completed sale
        // would have its settlement date overwritten by a second confirmation.
        if (sale!.State != SaleState.AwaitingPayment)
        {
            ThrowHelper.SaleNotAwaitingPayment(sale.PublicId);
        }

        sale.State = SaleState.Completed;

        if (sale.Billing is not null)
        {
            sale.Billing.PaidDate = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        }

        await dbContext.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
