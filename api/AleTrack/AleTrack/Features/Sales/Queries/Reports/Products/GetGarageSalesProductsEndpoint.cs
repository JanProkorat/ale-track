using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.Reports.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Sales.Queries.Reports.Products;

/// <summary>Request for the garage-sale product report over an inclusive date window.</summary>
public sealed record GetGarageSalesProductsRequest : ReportWindowRequest;

/// <summary>
/// Product movement for the Zboží tab: what sold, in what packaging, at what discount, and how
/// long the remaining stock lasts at that rate.
/// </summary>
/// <remarks>
/// Lines are read through <c>Sales.SelectMany(s =&gt; s.Items)</c> rather than off the SaleItems
/// set, so the completed-and-in-window filter stays on the sale where it belongs.
///
/// The stock half is an approximation by necessity: <see cref="Entities.InventoryItem.Quantity"/>
/// is a live value with no ledger behind it, so days-of-cover relates today's shelf to the
/// window's sales rate. A real stock ledger would make it exact (see the spec's known gaps).
/// </remarks>
internal sealed class GetGarageSalesProductsEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetGarageSalesProductsRequest, GarageSalesProductsReportDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("reports/garage-sales/products");
        Description(b => b
            .RequirePermission(ModuleType.Sales, PermissionLevel.View)
            .WithName(nameof(GetGarageSalesProductsEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets garage-sale product movement over a date window";
            s.Responses[StatusCodes.Status200OK] = "Top products, packaging split, discounts and stock coverage";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetGarageSalesProductsRequest req, CancellationToken ct)
    {
        var lines = await dbContext.Sales
            .AsNoTracking()
            .Where(s => s.State == SaleState.Completed && s.SaleDate >= req.From && s.SaleDate <= req.To)
            .SelectMany(s => s.Items.Select(i => new SoldLineRow
            {
                ProductPublicId = i.Product != null ? i.Product.PublicId : null,
                ProductId = i.ProductId,
                Name = i.Name,
                Kind = i.Kind,
                Quantity = i.Quantity,
                Litres = i.PackageSize != null ? i.Quantity * i.PackageSize.Value : 0,
                Revenue = i.Quantity * i.UnitPriceWithVat,
                // A line sold above list is not a negative discount — it must not offset real ones.
                Discount = i.ListPriceWithVat != null && i.ListPriceWithVat.Value > i.UnitPriceWithVat
                    ? (i.ListPriceWithVat.Value - i.UnitPriceWithVat) * i.Quantity
                    : 0m,
                ListValue = i.ListPriceWithVat != null ? i.ListPriceWithVat.Value * i.Quantity : 0m,
                InventoryItemId = i.InventoryItemId
            }))
            .ToListAsync(ct);

        var discountTotal = lines.Sum(l => l.Discount);
        var listValue = lines.Sum(l => l.ListValue);

        var result = new GarageSalesProductsReportDto
        {
            DiscountTotal = discountTotal,
            DiscountedRevenueShare = listValue > 0m ? (double)(discountTotal / listValue) : 0,
            TopProducts = lines
                // Free-form stock has no product behind it, so its snapshotted name is its identity.
                .GroupBy(l => l.ProductId?.ToString() ?? l.Name)
                .Select(g => new ProductSalesRowDto
                {
                    ProductId = g.Select(l => l.ProductPublicId).FirstOrDefault(id => id != null),
                    Name = g.First().Name,
                    Kind = g.First().Kind,
                    Units = g.Sum(l => l.Quantity),
                    Litres = g.Sum(l => l.Litres),
                    Revenue = g.Sum(l => l.Revenue),
                    DiscountTotal = g.Sum(l => l.Discount)
                })
                .OrderByDescending(p => p.Revenue)
                .ThenBy(p => p.Name)
                .ToList(),
            ByKind = lines
                .GroupBy(l => l.Kind)
                .Select(g => new SalesByKindDto
                {
                    Kind = g.Key,
                    Units = g.Sum(l => l.Quantity),
                    Litres = g.Sum(l => l.Litres),
                    Revenue = g.Sum(l => l.Revenue)
                })
                .OrderByDescending(k => k.Revenue)
                .ToList(),
            StockCoverage = await LoadStockCoverageAsync(lines, req.From, req.To, ct)
        };

        await Send.OkAsync(result, ct);
    }

    /// <summary>
    /// Relates every stock row that still has pieces to how fast it sold in the window.
    /// </summary>
    private async Task<List<StockCoverageRowDto>> LoadStockCoverageAsync(
        List<SoldLineRow> lines,
        DateOnly from,
        DateOnly to,
        CancellationToken ct)
    {
        var stock = await dbContext.InventoryItems
            .AsNoTracking()
            .Where(i => i.Quantity > 0)
            .Select(i => new
            {
                i.Id,
                i.PublicId,
                Name = i.Name ?? (i.Product != null ? i.Product.Name : null),
                i.Quantity
            })
            .ToListAsync(ct);

        var soldPerStockRow = lines
            .Where(l => l.InventoryItemId != null)
            .GroupBy(l => l.InventoryItemId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(l => l.Quantity));

        // Inclusive window, and never zero — a single-day window would otherwise divide by nothing.
        var windowDays = Math.Max(1, to.DayNumber - from.DayNumber + 1);

        return stock
            .Select(item =>
            {
                var unitsSold = soldPerStockRow.GetValueOrDefault(item.Id);

                return new StockCoverageRowDto
                {
                    InventoryItemId = item.PublicId,
                    Name = item.Name ?? string.Empty,
                    Quantity = item.Quantity,
                    UnitsSold = unitsSold,
                    DaysOfCover = unitsSold > 0
                        ? item.Quantity / (unitsSold / (double)windowDays)
                        : null
                };
            })
            // Never-sold rows lead — they are the ones worth acting on.
            .OrderByDescending(row => row.DaysOfCover is null)
            .ThenByDescending(row => row.DaysOfCover)
            .ThenBy(row => row.Name)
            .ToList();
    }

    /// <summary>One sold line, reduced to the numbers the report aggregates.</summary>
    private sealed record SoldLineRow
    {
        public Guid? ProductPublicId { get; init; }

        /// <summary>Database id of the product, used only as a grouping key.</summary>
        public long? ProductId { get; init; }

        public string Name { get; init; } = null!;
        public ProductKind? Kind { get; init; }
        public int Quantity { get; init; }
        public double Litres { get; init; }
        public decimal Revenue { get; init; }
        public decimal Discount { get; init; }

        /// <summary>What the same pieces would have cost at the snapshotted ceník price.</summary>
        public decimal ListValue { get; init; }

        public long? InventoryItemId { get; init; }
    }
}
