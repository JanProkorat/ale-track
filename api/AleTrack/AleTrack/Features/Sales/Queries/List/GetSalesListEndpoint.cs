using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Sales.Queries.List;

/// <summary>
/// Endpoint retrieving the list of garage sales, newest first.
/// </summary>
internal sealed class GetSalesListEndpoint(AleTrackDbContext dbContext)
    : Endpoint<FilterableRequest, List<SaleListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("sales");
        Description(b => b
            .RequirePermission(ModuleType.Sales, PermissionLevel.View)
            .WithName(nameof(GetSalesListEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets filtered garage sales list";
            s.Responses[StatusCodes.Status200OK] = "List of garage sales";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FilterableRequest req, CancellationToken ct)
    {
        var data = await dbContext.Sales
            .AsNoTracking()
            // Id breaks the tie so several sales rung up on one day keep a stable order.
            .OrderByDescending(s => s.SaleDate)
            .ThenByDescending(s => s.Id)
            .Select(s => new SaleListItemDto
            {
                Id = s.PublicId,
                SaleDate = s.SaleDate,
                State = s.State,
                BuyerKind = s.BuyerKind,
                BuyerName = s.BuyerName,
                ClientId = s.Client != null ? s.Client.PublicId : null,
                ClientName = s.Client != null ? s.Client.Name : null,
                Payment = s.Payment,
                DueDate = s.Billing != null ? s.Billing.DueDate : null,
                // Summed in the projection so the totals are computed by the database rather than
                // by loading every line of every sale.
                TotalQuantity = s.Items.Sum(i => i.Quantity),
                TotalPrice = s.Items.Sum(i => i.Quantity * i.UnitPriceWithVat)
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);

        await Send.OkAsync(data, cancellation: ct);
    }
}
