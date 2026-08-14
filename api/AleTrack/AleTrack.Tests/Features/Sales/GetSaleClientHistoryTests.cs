using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Sales.Queries.ClientHistory;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Sales;

/// <summary>
/// What a client has bought over the counter before, feeding the sale editor's "Dříve prodané" tab.
/// Drafts must stay out: a draft is not a purchase, and suggesting goods the customer never took
/// would be worse than suggesting nothing.
/// </summary>
public sealed class GetSaleClientHistoryTests
{
    private static InventoryItem Stock(long id, string name, double? packageSize = 30)
    {
        var product = ProductBuilder.BuildEntity(name: name, packageSize: packageSize);
        product.Id = id;

        return new InventoryItem
        {
            Id = id, PublicId = Guid.NewGuid(), ProductId = id, Product = product, Quantity = 20
        };
    }

    private static SaleItem Line(long id, long saleId, InventoryItem stock, int quantity, decimal price)
        => new()
        {
            Id = id,
            PublicId = Guid.NewGuid(),
            SaleId = saleId,
            InventoryItemId = stock.Id,
            InventoryItem = stock,
            ProductId = stock.ProductId,
            Name = stock.Product!.Name,
            PackageSize = stock.Product.PackageSize,
            Quantity = quantity,
            UnitPriceWithVat = price
        };

    private static Sale CompletedSale(long id, long clientId, DateOnly date, params SaleItem[] items)
        => SaleWith(id, clientId, date, SaleState.Completed, items);

    private static Sale SaleWith(long id, long clientId, DateOnly date, SaleState state, params SaleItem[] items)
    {
        var sale = new Sale
        {
            Id = id,
            PublicId = Guid.NewGuid(),
            SaleDate = date,
            State = state,
            BuyerKind = SaleBuyerKind.Client,
            ClientId = clientId,
            Payment = SalePaymentMethod.Cash,
            Items = [.. items]
        };

        foreach (var item in items)
        {
            item.Sale = sale;
            item.SaleId = id;
        }

        return sale;
    }

    private static async Task<List<SoldItemHistoryDto>> RunAsync(
        Client client, ICollection<Sale> sales, ICollection<SaleItem> lines, ICollection<InventoryItem> stock)
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], inventoryItems: stock, sales: sales, saleItems: lines);

        var endpoint = EndpointWithResponseBuilder<GetSaleClientHistoryRequest, List<SoldItemHistoryDto>, GetSaleClientHistoryEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetSaleClientHistoryRequest { Id = client.PublicId }, CancellationToken.None);

        return endpoint.Response;
    }

    [Fact]
    public async Task HandleAsync_ReturnsOneRowPerItemNewestFirst()
    {
        var client = ClientBuilder.BuildEntity(name: "Pivnice Na Rohu");
        client.Id = 4;
        var maz = Stock(1, "Svijanský Máz");
        var rytir = Stock(2, "Svijanský Rytíř");

        var older = CompletedSale(10, 4, new DateOnly(2026, 7, 1), Line(100, 10, maz, 2, 1800m));
        var newer = CompletedSale(11, 4, new DateOnly(2026, 8, 2), Line(101, 11, rytir, 3, 1350m));

        var result = await RunAsync(client, [older, newer], [.. older.Items, .. newer.Items], [maz, rytir]);

        result.Should().HaveCount(2);
        result[0].Name.Should().Be("Svijanský Rytíř");
        result[0].LastSoldDate.Should().Be(new DateOnly(2026, 8, 2));
        result[1].Name.Should().Be("Svijanský Máz");
    }

    [Fact]
    public async Task HandleAsync_ItemBoughtRepeatedly_CarriesTheLatestPriceAndQuantity()
    {
        var client = ClientBuilder.BuildEntity(name: "Pivnice Na Rohu");
        client.Id = 4;
        var maz = Stock(1, "Svijanský Máz");

        var older = CompletedSale(10, 4, new DateOnly(2026, 7, 1), Line(100, 10, maz, 2, 1800m));
        var newer = CompletedSale(11, 4, new DateOnly(2026, 8, 2), Line(101, 11, maz, 5, 1750m));

        var result = await RunAsync(client, [older, newer], [.. older.Items, .. newer.Items], [maz]);

        var row = result.Should().ContainSingle().Subject;
        row.LastUnitPriceWithVat.Should().Be(1750m, "the price offered should be the one last charged");
        row.LastQuantity.Should().Be(5);
        row.LastSoldDate.Should().Be(new DateOnly(2026, 8, 2));
        row.TimesSold.Should().Be(2);
    }

    [Fact]
    public async Task HandleAsync_DraftSale_IsExcluded()
    {
        var client = ClientBuilder.BuildEntity(name: "Pivnice Na Rohu");
        client.Id = 4;
        var maz = Stock(1, "Svijanský Máz");

        var draft = SaleWith(10, 4, new DateOnly(2026, 8, 12), SaleState.Draft, Line(100, 10, maz, 2, 1800m));

        var result = await RunAsync(client, [draft], [.. draft.Items], [maz]);

        result.Should().BeEmpty("a draft is not a purchase");
    }

    [Fact]
    public async Task HandleAsync_AnotherClientsSale_IsExcluded()
    {
        var client = ClientBuilder.BuildEntity(name: "Pivnice Na Rohu");
        client.Id = 4;
        var maz = Stock(1, "Svijanský Máz");

        var someoneElse = CompletedSale(10, 99, new DateOnly(2026, 8, 2), Line(100, 10, maz, 2, 1800m));

        var result = await RunAsync(client, [someoneElse], [.. someoneElse.Items], [maz]);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_LineWhoseStockRowIsGone_IsExcluded()
    {
        var client = ClientBuilder.BuildEntity(name: "Pivnice Na Rohu");
        client.Id = 4;

        var orphan = new SaleItem
        {
            Id = 100, PublicId = Guid.NewGuid(), SaleId = 10, InventoryItemId = null, InventoryItem = null,
            Name = "Zrušená položka", Quantity = 2, UnitPriceWithVat = 100m
        };
        var sale = CompletedSale(10, 4, new DateOnly(2026, 8, 2), orphan);

        var result = await RunAsync(client, [sale], [orphan], []);

        result.Should().BeEmpty("an item whose stock row is gone cannot be re-added, so it is not suggested");
    }

    [Fact]
    public async Task HandleAsync_SameItemTwiceOnOneSale_CountsAsOnePurchase()
    {
        var client = ClientBuilder.BuildEntity(name: "Pivnice Na Rohu");
        client.Id = 4;
        var maz = Stock(1, "Svijanský Máz");

        var sale = CompletedSale(
            10, 4, new DateOnly(2026, 8, 2),
            Line(100, 10, maz, 2, 1800m),
            Line(101, 10, maz, 1, 1750m));

        var result = await RunAsync(client, [sale], [.. sale.Items], [maz]);

        result.Should().ContainSingle().Which.TimesSold.Should().Be(1);
    }

    [Fact]
    public async Task HandleAsync_UnknownClient_Throws()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [], sales: [], saleItems: []);

        var endpoint = EndpointWithResponseBuilder<GetSaleClientHistoryRequest, List<SoldItemHistoryDto>, GetSaleClientHistoryEndpoint>
            .Create(dbContext.Object);
        var act = () => endpoint.HandleAsync(
            new GetSaleClientHistoryRequest { Id = Guid.NewGuid() }, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ErrorCodes.NotfoundError);
    }
}
