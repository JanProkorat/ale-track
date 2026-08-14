using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Sales.Commands.Delete;

/// <summary>
/// Request model for deleting a draft garage sale.
/// </summary>
public sealed record DeleteSaleRequest
{
    /// <summary>
    /// Public ID of the sale to delete.
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint deleting a draft garage sale.
/// </summary>
/// <remarks>
/// Drafts only. A completed sale is a record of goods that physically left the building; removing it
/// would leave the stock deducted with nothing explaining why.
/// </remarks>
internal sealed class DeleteSaleEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteSaleRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("sales/{id:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Sales, PermissionLevel.Edit)
            .WithName(nameof(DeleteSaleEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status204NoContent));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Deletes a draft garage sale";
            s.Responses[StatusCodes.Status204NoContent] = "Sale deleted";
            s.Responses[StatusCodes.Status404NotFound] = "Sale not found";
            s.Responses[StatusCodes.Status409Conflict] = "Sale is already completed";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteSaleRequest req, CancellationToken ct)
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

        dbContext.Sales.Remove(sale);
        await dbContext.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
