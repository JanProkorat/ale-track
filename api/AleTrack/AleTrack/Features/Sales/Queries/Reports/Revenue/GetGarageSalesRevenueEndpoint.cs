using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.Reports.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Sales.Queries.Reports.Revenue;

/// <summary>Request for the garage-sale revenue report over an inclusive date window.</summary>
public sealed record GetGarageSalesRevenueRequest : ReportWindowRequest
{
    /// <summary>Bucket width of the returned trend series. Defaults to weekly.</summary>
    public ReportGranularity Granularity { get; set; } = ReportGranularity.Week;
}

/// <summary>
/// Revenue for the Tržby tab: totals, a trend series, the cash/invoice split and the
/// outstanding-invoice list.
/// </summary>
/// <remarks>
/// Two queries rather than one: the totals are window-bound while the unpaid list is not, and
/// folding both into a single scan would mean fetching every invoice sale ever made just to
/// throw most of them away. Roll-up happens in memory for the same reason as the shipment
/// reports — week truncation is provider-specific and these windows are small.
/// </remarks>
internal sealed class GetGarageSalesRevenueEndpoint(AleTrackDbContext dbContext, TimeProvider timeProvider)
    : Endpoint<GetGarageSalesRevenueRequest, GarageSalesRevenueReportDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("reports/garage-sales/revenue");
        Description(b => b
            .RequirePermission(ModuleType.Sales, PermissionLevel.View)
            .WithName(nameof(GetGarageSalesRevenueEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets garage-sale revenue over a date window";
            s.Responses[StatusCodes.Status200OK] = "Revenue totals, trend, payment split and outstanding invoices";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetGarageSalesRevenueRequest req, CancellationToken ct)
    {
        var sales = await dbContext.Sales
            .AsNoTracking()
            .Where(s => s.State == SaleState.Completed && s.SaleDate >= req.From && s.SaleDate <= req.To)
            .Select(s => new SaleRevenueRow
            {
                SaleDate = s.SaleDate,
                Payment = s.Payment,
                Revenue = s.Items.Sum(i => i.Quantity * i.UnitPriceWithVat),
                Units = s.Items.Sum(i => i.Quantity),
                Litres = s.Items.Where(i => i.PackageSize != null).Sum(i => i.Quantity * i.PackageSize!.Value)
            })
            .ToListAsync(ct);

        var totalRevenue = sales.Sum(s => s.Revenue);

        var result = new GarageSalesRevenueReportDto
        {
            TotalRevenue = totalRevenue,
            SalesCount = sales.Count,
            AverageSale = sales.Count > 0 ? Math.Round(totalRevenue / sales.Count, 2) : 0m,
            TotalUnits = sales.Sum(s => s.Units),
            TotalLitres = sales.Sum(s => s.Litres),
            Trend = sales
                .GroupBy(s => ReportBucketing.BucketStart(s.SaleDate, req.Granularity))
                .OrderBy(g => g.Key)
                .Select(g => new RevenueSeriesPointDto
                {
                    BucketStart = g.Key,
                    Revenue = g.Sum(s => s.Revenue),
                    SalesCount = g.Count()
                })
                .ToList(),
            ByPayment = sales
                .GroupBy(s => s.Payment)
                .Select(g => new RevenueByPaymentDto
                {
                    Payment = g.Key,
                    Revenue = g.Sum(s => s.Revenue),
                    SalesCount = g.Count()
                })
                .OrderByDescending(p => p.Revenue)
                .ToList(),
            UnpaidInvoices = await LoadUnpaidInvoicesAsync(ct)
        };

        result.UnpaidTotal = result.UnpaidInvoices.Sum(i => i.Amount);

        await Send.OkAsync(result, ct);
    }

    /// <summary>
    /// Every completed invoice sale with no payment date, oldest first. Not window-filtered on
    /// purpose — see <see cref="GarageSalesRevenueReportDto.UnpaidInvoices"/>.
    /// </summary>
    private async Task<List<UnpaidInvoiceRowDto>> LoadUnpaidInvoicesAsync(CancellationToken ct)
    {
        var unpaid = await dbContext.Sales
            .AsNoTracking()
            .Where(s => s.State == SaleState.Completed
                        && s.Payment == SalePaymentMethod.Invoice
                        && (s.Billing == null || s.Billing.PaidDate == null))
            // Id breaks the tie so several invoices raised on one day keep a stable order.
            .OrderBy(s => s.SaleDate)
            .ThenBy(s => s.Id)
            .Select(s => new UnpaidInvoiceRowDto
            {
                SaleId = s.PublicId,
                SaleDate = s.SaleDate,
                DueDate = s.Billing != null ? s.Billing.DueDate : null,
                ClientId = s.Client != null ? s.Client.PublicId : null,
                BuyerLabel = s.Client != null ? s.Client.Name : s.BuyerName,
                Amount = s.Items.Sum(i => i.Quantity * i.UnitPriceWithVat)
            })
            .ToListAsync(ct);

        var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);

        foreach (var invoice in unpaid)
        {
            invoice.DaysOverdue = invoice.DueDate is null
                ? null
                : today.DayNumber - invoice.DueDate.Value.DayNumber;
        }

        return unpaid;
    }

    /// <summary>One completed sale, reduced to the numbers the report aggregates.</summary>
    private sealed record SaleRevenueRow
    {
        public DateOnly SaleDate { get; init; }
        public SalePaymentMethod Payment { get; init; }
        public decimal Revenue { get; init; }
        public int Units { get; init; }
        public double Litres { get; init; }
    }
}
