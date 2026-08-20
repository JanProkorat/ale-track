using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Reports.Utils;
using AleTrack.Features.Sales.Queries.Reports.Revenue;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Sales.Reports;

/// <summary>
/// The Tržby tab. Only completed sales are money; the unpaid-invoice list deliberately ignores
/// the report window, because an invoice that went unpaid four months ago is exactly the row
/// worth surfacing today.
/// </summary>
public sealed class GetGarageSalesRevenueTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 16, 9, 0, 0, TimeSpan.Zero);

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private static GetGarageSalesRevenueRequest Window(
        ReportGranularity granularity = ReportGranularity.Week) => new()
    {
        From = new DateOnly(2026, 8, 1),
        To = new DateOnly(2026, 8, 31),
        Granularity = granularity
    };

    private static Sale SaleWith(
        long id,
        DateOnly date,
        (int Quantity, decimal Price, double? PackageSize)[] lines,
        SaleState state = SaleState.Completed,
        SalePaymentMethod payment = SalePaymentMethod.Cash,
        DateOnly? dueDate = null,
        DateOnly? paidDate = null,
        Client? client = null)
    {
        return new Sale
        {
            Id = id,
            PublicId = Guid.NewGuid(),
            SaleDate = date,
            State = state,
            BuyerKind = client is null ? SaleBuyerKind.Walkin : SaleBuyerKind.Client,
            BuyerName = client is null ? "Josef Vrána" : null,
            Client = client,
            ClientId = client?.Id,
            Payment = payment,
            Billing = payment == SalePaymentMethod.Invoice
                ? new SaleBillingDetails
                {
                    Name = "Na Rohu gastro s.r.o.",
                    DueDate = dueDate,
                    PaidDate = paidDate
                }
                : null,
            Items = lines.Select((line, index) => new SaleItem
            {
                Id = id * 100 + index,
                PublicId = Guid.NewGuid(),
                SaleId = id,
                Name = $"Line {index}",
                Quantity = line.Quantity,
                UnitPriceWithVat = line.Price,
                PackageSize = line.PackageSize
            }).ToList()
        };
    }

    private static GetGarageSalesRevenueEndpoint Endpoint(params Sale[] sales)
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(sales: sales);
        return EndpointWithResponseBuilder<GetGarageSalesRevenueRequest, GarageSalesRevenueReportDto,
            GetGarageSalesRevenueEndpoint>.Create(dbContext.Object, new FixedTimeProvider(Now));
    }

    [Fact]
    public async Task HandleAsync_DraftSale_ExcludedFromRevenue()
    {
        // A draft moves no stock and has taken no money — it is not revenue.
        var endpoint = Endpoint(
            SaleWith(1, new DateOnly(2026, 8, 10), [(2, 100m, null)]),
            SaleWith(2, new DateOnly(2026, 8, 11), [(9, 999m, null)], state: SaleState.Draft));

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.TotalRevenue.Should().Be(200m);
        endpoint.Response.SalesCount.Should().Be(1);
        endpoint.Response.TotalUnits.Should().Be(2);
    }

    [Fact]
    public async Task HandleAsync_SaleOutsideWindow_ExcludedFromTotals()
    {
        var endpoint = Endpoint(
            SaleWith(1, new DateOnly(2026, 8, 10), [(1, 100m, null)]),
            SaleWith(2, new DateOnly(2026, 7, 31), [(1, 500m, null)]));

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.TotalRevenue.Should().Be(100m);
        endpoint.Response.SalesCount.Should().Be(1);
    }

    [Fact]
    public async Task HandleAsync_NoSales_ReturnsZeroedDtoWithoutDividing()
    {
        var endpoint = Endpoint();

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var response = endpoint.Response;
        response.TotalRevenue.Should().Be(0m);
        response.SalesCount.Should().Be(0);
        response.AverageSale.Should().Be(0m);
        response.TotalUnits.Should().Be(0);
        response.TotalLitres.Should().Be(0);
        response.Trend.Should().BeEmpty();
        response.ByPayment.Should().BeEmpty();
        response.UnpaidInvoices.Should().BeEmpty();
        response.UnpaidTotal.Should().Be(0m);
    }

    [Fact]
    public async Task HandleAsync_ComputesAverageSaleAndLitres()
    {
        var endpoint = Endpoint(
            SaleWith(1, new DateOnly(2026, 8, 10), [(2, 100m, 0.5), (1, 50m, 30.0)]),
            SaleWith(2, new DateOnly(2026, 8, 12), [(1, 250m, null)]));

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var response = endpoint.Response;
        response.TotalRevenue.Should().Be(500m);
        response.SalesCount.Should().Be(2);
        response.AverageSale.Should().Be(250m);
        response.TotalUnits.Should().Be(4);

        // Only lines that carry a package size contribute litres: 2 x 0.5 + 1 x 30.
        response.TotalLitres.Should().Be(31);
    }

    [Fact]
    public async Task HandleAsync_WeekGranularity_GroupsSalesIntoIsoWeekBuckets()
    {
        // 10. 8. is a Monday, 12. 8. the Wednesday of the same ISO week; 17. 8. opens the next.
        var endpoint = Endpoint(
            SaleWith(1, new DateOnly(2026, 8, 10), [(1, 100m, null)]),
            SaleWith(2, new DateOnly(2026, 8, 12), [(1, 200m, null)]),
            SaleWith(3, new DateOnly(2026, 8, 17), [(1, 50m, null)]));

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var trend = endpoint.Response.Trend;
        trend.Should().HaveCount(2);
        trend[0].BucketStart.Should().Be(new DateOnly(2026, 8, 10));
        trend[0].Revenue.Should().Be(300m);
        trend[0].SalesCount.Should().Be(2);
        trend[1].BucketStart.Should().Be(new DateOnly(2026, 8, 17));
        trend[1].Revenue.Should().Be(50m);
    }

    [Fact]
    public async Task HandleAsync_MonthGranularity_GroupsSalesIntoMonthBuckets()
    {
        var endpoint = Endpoint(
            SaleWith(1, new DateOnly(2026, 8, 3), [(1, 100m, null)]),
            SaleWith(2, new DateOnly(2026, 8, 29), [(1, 200m, null)]));

        await endpoint.HandleAsync(Window(ReportGranularity.Month), CancellationToken.None);

        var trend = endpoint.Response.Trend;
        trend.Should().HaveCount(1);
        trend[0].BucketStart.Should().Be(new DateOnly(2026, 8, 1));
        trend[0].Revenue.Should().Be(300m);
    }

    [Fact]
    public async Task HandleAsync_SplitsRevenueByPaymentMethod()
    {
        var endpoint = Endpoint(
            SaleWith(1, new DateOnly(2026, 8, 10), [(1, 100m, null)]),
            SaleWith(2, new DateOnly(2026, 8, 11), [(1, 300m, null)],
                payment: SalePaymentMethod.Invoice, dueDate: new DateOnly(2026, 8, 25)));

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var byPayment = endpoint.Response.ByPayment;
        byPayment.Should().HaveCount(2);
        byPayment.Single(p => p.Payment == SalePaymentMethod.Invoice).Revenue.Should().Be(300m);
        byPayment.Single(p => p.Payment == SalePaymentMethod.Cash).Revenue.Should().Be(100m);
        byPayment.Single(p => p.Payment == SalePaymentMethod.Cash).SalesCount.Should().Be(1);
    }

    [Fact]
    public async Task HandleAsync_UnpaidInvoices_IgnoreTheWindowAndExcludeCashAndPaid()
    {
        var endpoint = Endpoint(
            // Long before the window — still unpaid, so still worth chasing.
            SaleWith(1, new DateOnly(2026, 4, 2), [(1, 1000m, null)],
                payment: SalePaymentMethod.Invoice, dueDate: new DateOnly(2026, 4, 16)),
            // Settled — not outstanding.
            SaleWith(2, new DateOnly(2026, 8, 5), [(1, 400m, null)],
                payment: SalePaymentMethod.Invoice, dueDate: new DateOnly(2026, 8, 19),
                paidDate: new DateOnly(2026, 8, 12)),
            // Cash never appears in the outstanding list.
            SaleWith(3, new DateOnly(2026, 8, 6), [(1, 700m, null)]),
            // A draft invoice has not been handed over yet.
            SaleWith(4, new DateOnly(2026, 8, 7), [(1, 900m, null)],
                state: SaleState.Draft, payment: SalePaymentMethod.Invoice,
                dueDate: new DateOnly(2026, 8, 21)));

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var unpaid = endpoint.Response.UnpaidInvoices;
        unpaid.Should().HaveCount(1);
        unpaid[0].SaleDate.Should().Be(new DateOnly(2026, 4, 2));
        unpaid[0].Amount.Should().Be(1000m);
        unpaid[0].BuyerLabel.Should().Be("Josef Vrána");
        unpaid[0].DaysOverdue.Should().Be(122); // 16. 4. → 16. 8.
        endpoint.Response.UnpaidTotal.Should().Be(1000m);
    }

    [Fact]
    public async Task HandleAsync_UnpaidInvoiceNotYetDue_HasNegativeDaysOverdue()
    {
        var endpoint = Endpoint(
            SaleWith(1, new DateOnly(2026, 8, 14), [(1, 500m, null)],
                payment: SalePaymentMethod.Invoice, dueDate: new DateOnly(2026, 8, 28)));

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.UnpaidInvoices.Should().HaveCount(1);
        endpoint.Response.UnpaidInvoices[0].DaysOverdue.Should().Be(-12);
    }

    [Fact]
    public async Task HandleAsync_UnpaidInvoiceWithoutDueDate_HasNoOverdueCount()
    {
        var endpoint = Endpoint(
            SaleWith(1, new DateOnly(2026, 8, 14), [(1, 500m, null)],
                payment: SalePaymentMethod.Invoice));

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.UnpaidInvoices.Should().HaveCount(1);
        endpoint.Response.UnpaidInvoices[0].DaysOverdue.Should().BeNull();
    }

    [Fact]
    public async Task HandleAsync_UnpaidInvoices_OldestFirstAndCarryTheClient()
    {
        var client = new Client { Id = 7, PublicId = Guid.NewGuid(), Name = "Hospoda U Kotvy" };

        var endpoint = Endpoint(
            SaleWith(1, new DateOnly(2026, 8, 1), [(1, 100m, null)],
                payment: SalePaymentMethod.Invoice, dueDate: new DateOnly(2026, 8, 15), client: client),
            SaleWith(2, new DateOnly(2026, 5, 1), [(1, 200m, null)],
                payment: SalePaymentMethod.Invoice, dueDate: new DateOnly(2026, 5, 15)));

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var unpaid = endpoint.Response.UnpaidInvoices;
        unpaid.Should().HaveCount(2);
        unpaid[0].SaleDate.Should().Be(new DateOnly(2026, 5, 1));
        unpaid[1].BuyerLabel.Should().Be("Hospoda U Kotvy");
        unpaid[1].ClientId.Should().Be(client.PublicId);
        endpoint.Response.UnpaidTotal.Should().Be(300m);
    }
}
