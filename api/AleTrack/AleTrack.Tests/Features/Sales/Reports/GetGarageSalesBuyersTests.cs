using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Sales.Queries.Reports.Buyers;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Sales.Reports;

/// <summary>
/// The Kupující tab. Walk-ins are anonymous by design, so they aggregate as one bucket and
/// never as pseudo-clients keyed by a typed name.
/// </summary>
public sealed class GetGarageSalesBuyersTests
{
    private static GetGarageSalesBuyersRequest Window() => new()
    {
        From = new DateOnly(2026, 8, 1),
        To = new DateOnly(2026, 8, 31)
    };

    private static Client ClientWith(long id, string name) => new()
    {
        Id = id,
        PublicId = Guid.NewGuid(),
        Name = name
    };

    private static Sale SaleWith(
        long id,
        DateOnly date,
        decimal total,
        Client? client = null,
        string? walkinName = null,
        SaleState state = SaleState.Completed)
    {
        return new Sale
        {
            Id = id,
            PublicId = Guid.NewGuid(),
            SaleDate = date,
            State = state,
            BuyerKind = client is null ? SaleBuyerKind.Walkin : SaleBuyerKind.Client,
            BuyerName = client is null ? walkinName : null,
            Client = client,
            ClientId = client?.Id,
            Payment = SalePaymentMethod.Cash,
            Items =
            [
                new SaleItem
                {
                    Id = id * 100,
                    PublicId = Guid.NewGuid(),
                    SaleId = id,
                    Name = "Ležák 12°",
                    Quantity = 1,
                    UnitPriceWithVat = total
                }
            ]
        };
    }

    private static GetGarageSalesBuyersEndpoint Endpoint(params Sale[] sales)
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(sales: sales);
        return EndpointWithResponseBuilder<GetGarageSalesBuyersRequest, GarageSalesBuyersReportDto,
            GetGarageSalesBuyersEndpoint>.Create(dbContext.Object);
    }

    [Fact]
    public async Task HandleAsync_SplitsRevenueBetweenClientsAndWalkins()
    {
        var client = ClientWith(1, "Hospoda U Kotvy");

        var endpoint = Endpoint(
            SaleWith(1, new DateOnly(2026, 8, 10), 1000m, client: client),
            SaleWith(2, new DateOnly(2026, 8, 11), 250m, walkinName: "Josef Vrána"));

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var byKind = endpoint.Response.ByBuyerKind;
        byKind.Should().HaveCount(2);
        byKind.Single(b => b.BuyerKind == SaleBuyerKind.Client).Revenue.Should().Be(1000m);
        byKind.Single(b => b.BuyerKind == SaleBuyerKind.Walkin).Revenue.Should().Be(250m);
        byKind.Single(b => b.BuyerKind == SaleBuyerKind.Walkin).SalesCount.Should().Be(1);
    }

    [Fact]
    public async Task HandleAsync_DifferentlyNamedWalkins_StayOneBucket()
    {
        var endpoint = Endpoint(
            SaleWith(1, new DateOnly(2026, 8, 10), 100m, walkinName: "Josef Vrána"),
            SaleWith(2, new DateOnly(2026, 8, 11), 200m, walkinName: "Marie Nová"),
            SaleWith(3, new DateOnly(2026, 8, 12), 300m));

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.ByBuyerKind.Should().HaveCount(1);
        endpoint.Response.ByBuyerKind[0].BuyerKind.Should().Be(SaleBuyerKind.Walkin);
        endpoint.Response.ByBuyerKind[0].SalesCount.Should().Be(3);
        endpoint.Response.TopClients.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_ClientWithTwoSales_IsARepeatBuyerWithNewestLastPurchase()
    {
        var repeat = ClientWith(1, "Hospoda U Kotvy");
        var once = ClientWith(2, "Restaurace Na Rynku");

        var endpoint = Endpoint(
            SaleWith(1, new DateOnly(2026, 8, 3), 400m, client: repeat),
            SaleWith(2, new DateOnly(2026, 8, 20), 600m, client: repeat),
            SaleWith(3, new DateOnly(2026, 8, 5), 900m, client: once));

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.RepeatBuyers.Should().Be(1);
        endpoint.Response.OneTimeBuyers.Should().Be(1);

        var top = endpoint.Response.TopClients;
        top.Should().HaveCount(2);
        top[0].ClientName.Should().Be("Hospoda U Kotvy"); // 1000 > 900
        top[0].ClientId.Should().Be(repeat.PublicId);
        top[0].SalesCount.Should().Be(2);
        top[0].Revenue.Should().Be(1000m);
        top[0].LastPurchase.Should().Be(new DateOnly(2026, 8, 20));
    }

    [Fact]
    public async Task HandleAsync_DraftSale_ExcludedFromBuyerTotals()
    {
        var client = ClientWith(1, "Hospoda U Kotvy");

        var endpoint = Endpoint(
            SaleWith(1, new DateOnly(2026, 8, 10), 500m, client: client),
            SaleWith(2, new DateOnly(2026, 8, 11), 900m, client: client, state: SaleState.Draft));

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.TopClients.Should().HaveCount(1);
        endpoint.Response.TopClients[0].SalesCount.Should().Be(1);
        endpoint.Response.TopClients[0].Revenue.Should().Be(500m);
        endpoint.Response.RepeatBuyers.Should().Be(0);
        endpoint.Response.OneTimeBuyers.Should().Be(1);
    }

    [Fact]
    public async Task HandleAsync_SaleOutsideWindow_ExcludedFromBuyerTotals()
    {
        var client = ClientWith(1, "Hospoda U Kotvy");

        var endpoint = Endpoint(
            SaleWith(1, new DateOnly(2026, 8, 10), 500m, client: client),
            SaleWith(2, new DateOnly(2026, 9, 1), 900m, client: client));

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.TopClients[0].Revenue.Should().Be(500m);
        endpoint.Response.RepeatBuyers.Should().Be(0);
    }

    [Fact]
    public async Task HandleAsync_NoSales_ReturnsZeroedDto()
    {
        var endpoint = Endpoint();

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.ByBuyerKind.Should().BeEmpty();
        endpoint.Response.TopClients.Should().BeEmpty();
        endpoint.Response.RepeatBuyers.Should().Be(0);
        endpoint.Response.OneTimeBuyers.Should().Be(0);
    }
}
