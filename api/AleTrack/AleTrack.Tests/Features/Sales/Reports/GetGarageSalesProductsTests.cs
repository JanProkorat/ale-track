using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Sales.Queries.Reports.Products;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Sales.Reports;

/// <summary>
/// The Zboží tab. The discount figures are real rather than reconstructed, because
/// <see cref="SaleItem.ListPriceWithVat"/> is snapshotted on the line when it is sold.
/// </summary>
public sealed class GetGarageSalesProductsTests
{
    private static GetGarageSalesProductsRequest Window() => new()
    {
        From = new DateOnly(2026, 8, 1),
        To = new DateOnly(2026, 8, 31)
    };

    private static Sale SaleWith(long id, DateOnly date, SaleItem[] items, SaleState state = SaleState.Completed)
    {
        return new Sale
        {
            Id = id,
            PublicId = Guid.NewGuid(),
            SaleDate = date,
            State = state,
            BuyerKind = SaleBuyerKind.Walkin,
            Payment = SalePaymentMethod.Cash,
            Items = items.ToList()
        };
    }

    private static SaleItem Line(
        long id,
        string name,
        int quantity,
        decimal unitPrice,
        decimal? listPrice = null,
        ProductKind? kind = ProductKind.Keg,
        double? packageSize = 50,
        long? productId = null,
        long? inventoryItemId = null)
    {
        return new SaleItem
        {
            Id = id,
            PublicId = Guid.NewGuid(),
            Name = name,
            Quantity = quantity,
            UnitPriceWithVat = unitPrice,
            ListPriceWithVat = listPrice,
            Kind = kind,
            PackageSize = packageSize,
            ProductId = productId,
            InventoryItemId = inventoryItemId
        };
    }

    private static InventoryItem Stock(long id, string name, int quantity, long? productId = null) => new()
    {
        Id = id,
        PublicId = Guid.NewGuid(),
        Name = name,
        Quantity = quantity,
        ProductId = productId
    };

    private static GetGarageSalesProductsEndpoint Endpoint(
        ICollection<Sale>? sales = null,
        ICollection<InventoryItem>? inventoryItems = null)
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            sales: sales ?? [],
            inventoryItems: inventoryItems ?? []);

        return EndpointWithResponseBuilder<GetGarageSalesProductsRequest, GarageSalesProductsReportDto,
            GetGarageSalesProductsEndpoint>.Create(dbContext.Object);
    }

    [Fact]
    public async Task HandleAsync_AggregatesProductRevenueUnitsAndLitres()
    {
        var endpoint = Endpoint(sales:
        [
            SaleWith(1, new DateOnly(2026, 8, 10), [Line(1, "Ležák 12°", quantity: 2, unitPrice: 1500m, productId: 5)]),
            SaleWith(2, new DateOnly(2026, 8, 12), [Line(2, "Ležák 12°", quantity: 1, unitPrice: 1500m, productId: 5)])
        ]);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.TopProducts.Should().HaveCount(1);
        var row = endpoint.Response.TopProducts[0];
        row.Name.Should().Be("Ležák 12°");
        row.Units.Should().Be(3);
        row.Revenue.Should().Be(4500m);
        row.Litres.Should().Be(150);
    }

    [Fact]
    public async Task HandleAsync_FreeFormLineWithoutProduct_GroupsBySnapshottedName()
    {
        // Vratné basy have no product behind them, so the name is the only identity they have.
        var endpoint = Endpoint(sales:
        [
            SaleWith(1, new DateOnly(2026, 8, 10),
            [
                Line(1, "Vratná basa", quantity: 2, unitPrice: 150m, kind: null, packageSize: null),
                Line(2, "Vratná basa", quantity: 3, unitPrice: 150m, kind: null, packageSize: null)
            ])
        ]);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.TopProducts.Should().HaveCount(1);
        endpoint.Response.TopProducts[0].ProductId.Should().BeNull();
        endpoint.Response.TopProducts[0].Units.Should().Be(5);
        endpoint.Response.TopProducts[0].Litres.Should().Be(0);
    }

    [Fact]
    public async Task HandleAsync_DiscountedLine_CountsTheDifferenceFromListPrice()
    {
        var endpoint = Endpoint(sales:
        [
            SaleWith(1, new DateOnly(2026, 8, 10),
                [Line(1, "Ležák 12°", quantity: 3, unitPrice: 1400m, listPrice: 1500m, productId: 5)])
        ]);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.DiscountTotal.Should().Be(300m);
        endpoint.Response.TopProducts[0].DiscountTotal.Should().Be(300m);
    }

    [Fact]
    public async Task HandleAsync_LineSoldAboveListPrice_ContributesNoDiscount()
    {
        // A surcharge is not a negative discount — it must not offset real discounts elsewhere.
        var endpoint = Endpoint(sales:
        [
            SaleWith(1, new DateOnly(2026, 8, 10),
            [
                Line(1, "Ležák 12°", quantity: 2, unitPrice: 1600m, listPrice: 1500m, productId: 5),
                Line(2, "Světlé 10°", quantity: 1, unitPrice: 900m, listPrice: 1000m, productId: 6)
            ])
        ]);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.DiscountTotal.Should().Be(100m);
    }

    [Fact]
    public async Task HandleAsync_LineWithoutListPrice_ContributesNoDiscount()
    {
        var endpoint = Endpoint(sales:
        [
            SaleWith(1, new DateOnly(2026, 8, 10),
                [Line(1, "Vratná basa", quantity: 4, unitPrice: 150m, kind: null, packageSize: null)])
        ]);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.DiscountTotal.Should().Be(0m);
    }

    [Fact]
    public async Task HandleAsync_GroupsByProductKind()
    {
        var endpoint = Endpoint(sales:
        [
            SaleWith(1, new DateOnly(2026, 8, 10),
            [
                Line(1, "Ležák 12°", quantity: 2, unitPrice: 1500m, kind: ProductKind.Keg, packageSize: 50),
                Line(2, "Radler", quantity: 10, unitPrice: 25m, kind: ProductKind.Can, packageSize: 0.5)
            ])
        ]);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var byKind = endpoint.Response.ByKind;
        byKind.Should().HaveCount(2);
        byKind.Single(k => k.Kind == ProductKind.Keg).Litres.Should().Be(100);
        byKind.Single(k => k.Kind == ProductKind.Can).Units.Should().Be(10);
    }

    [Fact]
    public async Task HandleAsync_DraftSale_ExcludedFromProductTotals()
    {
        var endpoint = Endpoint(sales:
        [
            SaleWith(1, new DateOnly(2026, 8, 10), [Line(1, "Ležák 12°", 1, 1500m, productId: 5)]),
            SaleWith(2, new DateOnly(2026, 8, 11), [Line(2, "Ležák 12°", 9, 1500m, productId: 5)],
                state: SaleState.Draft)
        ]);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.TopProducts[0].Units.Should().Be(1);
    }

    [Fact]
    public async Task HandleAsync_StockWithNoSales_HasNoDaysOfCover()
    {
        // Never sold is a distinct state from "years of cover" — it must not become a number.
        var endpoint = Endpoint(
            sales: [],
            inventoryItems: [Stock(1, "Vánoční speciál", quantity: 12)]);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.StockCoverage.Should().HaveCount(1);
        endpoint.Response.StockCoverage[0].Name.Should().Be("Vánoční speciál");
        endpoint.Response.StockCoverage[0].Quantity.Should().Be(12);
        endpoint.Response.StockCoverage[0].UnitsSold.Should().Be(0);
        endpoint.Response.StockCoverage[0].DaysOfCover.Should().BeNull();
    }

    [Fact]
    public async Task HandleAsync_StockSoldInTheWindow_ReportsDaysOfCover()
    {
        // 31 days in the window, 31 pieces sold — one a day, so 10 in stock is 10 days of cover.
        var endpoint = Endpoint(
            sales:
            [
                SaleWith(1, new DateOnly(2026, 8, 10),
                    [Line(1, "Ležák 12°", quantity: 31, unitPrice: 1500m, productId: 5, inventoryItemId: 1)])
            ],
            inventoryItems: [Stock(1, "Ležák 12°", quantity: 10, productId: 5)]);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var deadStock = endpoint.Response.StockCoverage.Single();
        deadStock.UnitsSold.Should().Be(31);
        deadStock.DaysOfCover.Should().BeApproximately(10, 0.01);
    }

    [Fact]
    public async Task HandleAsync_EmptyStock_IsNotListed()
    {
        var endpoint = Endpoint(inventoryItems: [Stock(1, "Vyprodáno", quantity: 0)]);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.StockCoverage.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_NoSales_ReturnsZeroedDto()
    {
        var endpoint = Endpoint();

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var response = endpoint.Response;
        response.TopProducts.Should().BeEmpty();
        response.ByKind.Should().BeEmpty();
        response.DiscountTotal.Should().Be(0m);
        response.DiscountedRevenueShare.Should().Be(0);
        response.StockCoverage.Should().BeEmpty();
    }
}
