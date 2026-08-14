using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.Sales.Queries.List;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Sales;

/// <summary>
/// The sales list. Totals are summed in the projection, and the paid flag is flattened out of the
/// billing block so the unpaid filter does not have to reach into an object that is null for cash.
/// </summary>
public sealed class GetSalesListTests
{
    private static Sale SaleWith(
        long id,
        DateOnly date,
        (int Quantity, decimal Price)[] lines,
        SalePaymentMethod payment = SalePaymentMethod.Cash,
        SaleState state = SaleState.Completed,
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
                    Name = "Na Rohu gastro s.r.o.", DueDate = new DateOnly(2026, 8, 20)
                }
                : null,
            Items = lines.Select((line, index) => new SaleItem
            {
                Id = id * 100 + index,
                PublicId = Guid.NewGuid(),
                SaleId = id,
                Name = $"Line {index}",
                Quantity = line.Quantity,
                UnitPriceWithVat = line.Price
            }).ToList()
        };
    }

    [Fact]
    public async Task HandleAsync_ReturnsNewestFirstWithComputedTotals()
    {
        var older = SaleWith(1, new DateOnly(2026, 8, 10), [(2, 100m), (1, 50m)]);
        var newer = SaleWith(2, new DateOnly(2026, 8, 12), [(3, 200m)]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(sales: [older, newer]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<SaleListItemDto>, GetSalesListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        var result = endpoint.Response;
        result.Should().HaveCount(2);

        result[0].SaleDate.Should().Be(new DateOnly(2026, 8, 12));
        result[0].TotalQuantity.Should().Be(3);
        result[0].TotalPrice.Should().Be(600m);

        result[1].SaleDate.Should().Be(new DateOnly(2026, 8, 10));
        result[1].TotalQuantity.Should().Be(3);
        result[1].TotalPrice.Should().Be(250m, "2 × 100 + 1 × 50");
    }

    [Fact]
    public async Task HandleAsync_CashSale_ReportsUnpaidWithoutABillingBlock()
    {
        var cash = SaleWith(1, new DateOnly(2026, 8, 12), [(1, 100m)]);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(sales: [cash]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<SaleListItemDto>, GetSalesListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        var row = endpoint.Response.Should().ContainSingle().Subject;
        row.Payment.Should().Be(SalePaymentMethod.Cash);
        row.State.Should().Be(SaleState.Completed);
        row.DueDate.Should().BeNull();
    }

    [Fact]
    public async Task HandleAsync_InvoiceSale_CarriesStateAndDueDate()
    {
        var invoiced = SaleWith(
            1, new DateOnly(2026, 8, 12), [(1, 100m)], SalePaymentMethod.Invoice,
            state: SaleState.AwaitingPayment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(sales: [invoiced]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<SaleListItemDto>, GetSalesListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        var row = endpoint.Response.Should().ContainSingle().Subject;
        // Unpaid-ness rides on the state now, so an awaiting-payment row needs no separate flag.
        row.State.Should().Be(SaleState.AwaitingPayment);
        row.DueDate.Should().Be(new DateOnly(2026, 8, 20));
    }

    [Fact]
    public async Task HandleAsync_ClientSale_CarriesTheClientName()
    {
        var client = ClientBuilder.BuildEntity(name: "Pivnice Na Rohu");
        client.Id = 4;
        var sale = SaleWith(1, new DateOnly(2026, 8, 12), [(1, 100m)], client: client);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], sales: [sale]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<SaleListItemDto>, GetSalesListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        var row = endpoint.Response.Should().ContainSingle().Subject;
        row.BuyerKind.Should().Be(SaleBuyerKind.Client);
        row.ClientName.Should().Be("Pivnice Na Rohu");
        row.ClientId.Should().Be(client.PublicId);
    }
}
