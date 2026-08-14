using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Sales.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Sales.Commands.Update;

/// <summary>
/// Request model for changing a draft garage sale.
/// </summary>
public sealed record UpdateSaleRequest
{
    /// <summary>
    /// Public ID of the sale to change.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public UpdateSaleDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint changing a draft garage sale.
/// </summary>
/// <remarks>
/// Refuses a completed sale: its pieces have already left the shelf, so editing it would
/// desynchronise the stock ledger from what was actually handed over.
/// </remarks>
internal sealed class UpdateSaleEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateSaleRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("sales/{id:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Sales, PermissionLevel.Edit)
            .WithName(nameof(UpdateSaleEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status204NoContent));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Changes a draft garage sale";
            s.Responses[StatusCodes.Status204NoContent] = "Sale updated";
            s.Responses[StatusCodes.Status404NotFound] = "Sale, client or inventory item not found";
            s.Responses[StatusCodes.Status409Conflict] = "Sale is already completed";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateSaleRequest req, CancellationToken ct)
    {
        var sale = await dbContext.Sales
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.PublicId == req.Id, ct);

        if (sale is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Sale), req.Id);
        }

        if (sale!.State != SaleState.Draft)
        {
            ThrowHelper.SaleAlreadyCompleted(sale.PublicId);
        }

        sale.SaleDate = req.Data.SaleDate;
        sale.BuyerKind = req.Data.BuyerKind;
        sale.ClientId = await ResolveClientIdAsync(req.Data.ClientId, ct);
        sale.BuyerName = req.Data.BuyerKind == SaleBuyerKind.Walkin ? req.Data.BuyerName : null;
        sale.Payment = req.Data.Payment;
        sale.Billing = SaleBillingWriter.From(req.Data.Payment, req.Data.Billing, sale.Billing);
        sale.Note = req.Data.Note;

        // Lines are replaced wholesale rather than diffed: they are cheap, and a diff would have to
        // decide what "the same line" means when the same stock row appears twice at two prices.
        dbContext.SaleItems.RemoveRange(sale.Items);
        sale.Items = await SaleLineWriter.BuildLinesAsync(dbContext, req.Data.Items, ct);

        await dbContext.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }

    private async Task<long?> ResolveClientIdAsync(Guid? clientPublicId, CancellationToken ct)
    {
        if (clientPublicId is null)
        {
            return null;
        }

        var client = await dbContext.Clients
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.PublicId == clientPublicId && !c.IsDeleted, ct);

        if (client is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Client), clientPublicId.Value);
        }

        return client!.Id;
    }
}
