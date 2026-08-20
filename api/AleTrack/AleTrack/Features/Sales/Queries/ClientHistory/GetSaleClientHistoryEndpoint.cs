using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Sales.Queries.ClientHistory;

/// <summary>
/// Request model for retrieving what a client has bought over the counter before.
/// </summary>
public sealed record GetSaleClientHistoryRequest
{
    /// <summary>
    /// Public ID of the client.
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint listing the stock items a client has previously bought, most recently bought first.
/// </summary>
/// <remarks>
/// Feeds the "Dříve prodané" tab of the sale editor. Only completed sales count: a draft is not a
/// purchase, and letting drafts in would suggest goods the customer never actually took.
/// </remarks>
internal sealed class GetSaleClientHistoryEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetSaleClientHistoryRequest, List<SoldItemHistoryDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("sales/clients/{id:guid}/history");
        Description(b => b
            .RequirePermission(ModuleType.Sales, PermissionLevel.View)
            .WithName(nameof(GetSaleClientHistoryEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets the stock items a client has bought over the counter before";
            s.Responses[StatusCodes.Status200OK] = "Previously sold items, most recent first";
            s.Responses[StatusCodes.Status404NotFound] = "Client not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetSaleClientHistoryRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.PublicId == req.Id && !c.IsDeleted, ct);

        if (client is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.Id);
        }

        // Lines are read rather than grouped in SQL: the projection needs the newest line's name,
        // price and quantity per stock row, which is a per-group top-1 rather than an aggregate.
        var lines = await dbContext.SaleItems
            .AsNoTracking()
            .Where(i => i.Sale.ClientId == client!.Id
                     && i.Sale.State == SaleState.Completed
                     && i.InventoryItem != null)
            .Select(i => new
            {
                InventoryItemId = i.InventoryItem!.PublicId,
                i.Name,
                i.PackageSize,
                i.Sale.SaleDate,
                i.UnitPriceWithVat,
                i.Quantity,
                SaleId = i.SaleId
            })
            .ToListAsync(ct);

        var history = lines
            .GroupBy(l => l.InventoryItemId)
            .Select(group =>
            {
                var latest = group.OrderByDescending(l => l.SaleDate).ThenByDescending(l => l.SaleId).First();

                return new SoldItemHistoryDto
                {
                    InventoryItemId = group.Key,
                    Name = latest.Name,
                    PackageSize = latest.PackageSize,
                    LastSoldDate = latest.SaleDate,
                    LastUnitPriceWithVat = latest.UnitPriceWithVat,
                    LastQuantity = latest.Quantity,
                    // Distinct sales, not lines: the same item twice on one sale is one purchase.
                    TimesSold = group.Select(l => l.SaleId).Distinct().Count()
                };
            })
            .OrderByDescending(h => h.LastSoldDate)
            .ThenBy(h => h.Name)
            .ToList();

        await Send.OkAsync(history, cancellation: ct);
    }
}
