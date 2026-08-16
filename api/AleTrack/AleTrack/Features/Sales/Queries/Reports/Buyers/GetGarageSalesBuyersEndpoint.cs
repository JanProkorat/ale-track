using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.Reports.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Sales.Queries.Reports.Buyers;

/// <summary>Request for the garage-sale buyer report over an inclusive date window.</summary>
public sealed record GetGarageSalesBuyersRequest : ReportWindowRequest;

/// <summary>
/// Buyer mix for the Kupující tab: the client/walk-in split, the top clients, and how many of
/// them came back inside the window.
/// </summary>
internal sealed class GetGarageSalesBuyersEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetGarageSalesBuyersRequest, GarageSalesBuyersReportDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("reports/garage-sales/buyers");
        Description(b => b
            .RequirePermission(ModuleType.Sales, PermissionLevel.View)
            .WithName(nameof(GetGarageSalesBuyersEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets the garage-sale buyer mix over a date window";
            s.Responses[StatusCodes.Status200OK] = "Buyer-kind split, top clients and repeat-buyer counts";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetGarageSalesBuyersRequest req, CancellationToken ct)
    {
        var sales = await dbContext.Sales
            .AsNoTracking()
            .Where(s => s.State == SaleState.Completed && s.SaleDate >= req.From && s.SaleDate <= req.To)
            .Select(s => new BuyerSaleRow
            {
                SaleDate = s.SaleDate,
                BuyerKind = s.BuyerKind,
                ClientId = s.Client != null ? s.Client.PublicId : null,
                ClientName = s.Client != null ? s.Client.Name : null,
                Revenue = s.Items.Sum(i => i.Quantity * i.UnitPriceWithVat)
            })
            .ToListAsync(ct);

        var topClients = sales
            .Where(s => s.ClientId != null)
            .GroupBy(s => new { ClientId = s.ClientId!.Value, s.ClientName })
            .Select(g => new BuyerClientRowDto
            {
                ClientId = g.Key.ClientId,
                ClientName = g.Key.ClientName ?? string.Empty,
                SalesCount = g.Count(),
                Revenue = g.Sum(s => s.Revenue),
                LastPurchase = g.Max(s => s.SaleDate)
            })
            .OrderByDescending(c => c.Revenue)
            .ThenBy(c => c.ClientName)
            .ToList();

        var result = new GarageSalesBuyersReportDto
        {
            ByBuyerKind = sales
                .GroupBy(s => s.BuyerKind)
                .Select(g => new BuyerKindRowDto
                {
                    BuyerKind = g.Key,
                    Revenue = g.Sum(s => s.Revenue),
                    SalesCount = g.Count()
                })
                .OrderByDescending(b => b.Revenue)
                .ToList(),
            TopClients = topClients,
            RepeatBuyers = topClients.Count(c => c.SalesCount > 1),
            OneTimeBuyers = topClients.Count(c => c.SalesCount == 1)
        };

        await Send.OkAsync(result, ct);
    }

    /// <summary>One completed sale, reduced to who bought and for how much.</summary>
    private sealed record BuyerSaleRow
    {
        public DateOnly SaleDate { get; init; }
        public SaleBuyerKind BuyerKind { get; init; }
        public Guid? ClientId { get; init; }
        public string? ClientName { get; init; }
        public decimal Revenue { get; init; }
    }
}
