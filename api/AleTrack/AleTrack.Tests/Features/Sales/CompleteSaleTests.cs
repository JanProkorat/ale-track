using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Sales.Commands.Complete;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Sales;

/// <summary>
/// Completing a garage sale — the only path other than an outgoing shipment that takes stock off the
/// shelf. The rejection tests carry the most weight: a half-deducted sale cannot be repaired,
/// because this version has no storno.
/// </summary>
public sealed class CompleteSaleTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 13, 10, 30, 0, TimeSpan.Zero);

    /// <summary>The injected clock, pinned so the recorded completion timestamp is assertable.</summary>
    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed record Fixture(
        Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> DbContext,
        Sale Sale,
        InventoryItem StockA,
        InventoryItem StockB);

    private static Fixture Build(int stockA, int soldA, int stockB, int soldB)
    {
        var productA = ProductBuilder.BuildEntity(name: "Albrecht 12° Světlý ležák", priceWithVat: 1290m);
        productA.Id = 1;

        var rowA = new InventoryItem
        {
            Id = 10, PublicId = Guid.NewGuid(), ProductId = 1, Product = productA, Quantity = stockA
        };
        var rowB = new InventoryItem
        {
            Id = 11, PublicId = Guid.NewGuid(), ProductId = null, Name = "Vratné basy (prázdné)", Quantity = stockB
        };

        var sale = new Sale
        {
            Id = 5,
            PublicId = Guid.NewGuid(),
            SaleDate = new DateOnly(2026, 8, 13),
            State = SaleState.Draft,
            BuyerKind = SaleBuyerKind.Walkin,
            Payment = SalePaymentMethod.Cash,
            Items =
            [
                new SaleItem
                {
                    Id = 100, PublicId = Guid.NewGuid(), SaleId = 5, InventoryItemId = rowA.Id,
                    InventoryItem = rowA, ProductId = 1, Name = "Albrecht 12° Světlý ležák",
                    Quantity = soldA, UnitPriceWithVat = 1290m, ListPriceWithVat = 1290m
                },
                new SaleItem
                {
                    Id = 101, PublicId = Guid.NewGuid(), SaleId = 5, InventoryItemId = rowB.Id,
                    InventoryItem = rowB, Name = "Vratné basy (prázdné)",
                    Quantity = soldB, UnitPriceWithVat = 200m
                }
            ]
        };

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            products: [productA], inventoryItems: [rowA, rowB], sales: [sale]);

        return new Fixture(dbContext, sale, rowA, rowB);
    }

    /// <summary>
    /// Builds the endpoint with the sale id on the route. It is an EndpointWithoutRequest: a
    /// route-only request DTO would make FastEndpoints demand a JSON body on POST and answer 415.
    /// </summary>
    private static CompleteSaleEndpoint Endpoint(Fixture fixture, Guid? id = null)
    {
        var endpoint = EndpointWithoutRequestBuilder<CompleteSaleEndpoint>
            .Create(fixture.DbContext.Object, new FixedTimeProvider(Now));
        endpoint.HttpContext.Request.RouteValues["id"] = (id ?? fixture.Sale.PublicId).ToString();
        return endpoint;
    }

    [Fact]
    public async Task HandleAsync_CompletesSale_DecrementsInventoryQuantities()
    {
        var fixture = Build(stockA: 14, soldA: 4, stockB: 64, soldB: 2);

        await Endpoint(fixture).HandleAsync(CancellationToken.None);

        fixture.StockA.Quantity.Should().Be(10);
        fixture.StockB.Quantity.Should().Be(62);
        fixture.Sale.State.Should().Be(SaleState.Completed);
        fixture.Sale.CompletedAt.Should().Be(Now);
        fixture.DbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_InvoiceSale_AwaitsPaymentButStillDeductsStock()
    {
        var fixture = Build(stockA: 14, soldA: 4, stockB: 64, soldB: 2);
        fixture.Sale.Payment = SalePaymentMethod.Invoice;
        fixture.Sale.Billing = new SaleBillingDetails
        {
            Name = "Na Rohu gastro s.r.o.", DueDate = new DateOnly(2026, 8, 27)
        };

        await Endpoint(fixture).HandleAsync(CancellationToken.None);

        // The goods left the counter, so Sklad must reflect that even though nobody has paid yet.
        fixture.StockA.Quantity.Should().Be(10);
        fixture.StockB.Quantity.Should().Be(62);
        fixture.Sale.State.Should().Be(SaleState.AwaitingPayment, "an invoice is not settled at handover");
        fixture.Sale.CompletedAt.Should().Be(Now);
    }

    [Fact]
    public async Task HandleAsync_CashSale_CompletesOutright()
    {
        var fixture = Build(stockA: 14, soldA: 4, stockB: 64, soldB: 2);

        await Endpoint(fixture).HandleAsync(CancellationToken.None);

        fixture.Sale.State.Should().Be(SaleState.Completed, "cash is paid at the counter");
    }

    [Fact]
    public async Task HandleAsync_QuantityExceedsStock_ThrowsAndDoesNotTouchInventory()
    {
        var fixture = Build(stockA: 3, soldA: 4, stockB: 64, soldB: 2);

        var act = () => Endpoint(fixture).HandleAsync(CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ErrorCodes.SaleInsufficientStock);

        fixture.StockA.Quantity.Should().Be(3, "a refused completion must not decrement anything");
        fixture.StockB.Quantity.Should().Be(64, "not even the lines that would have fitted");
        fixture.Sale.State.Should().Be(SaleState.Draft);
        fixture.DbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_InventoryRowReachesZero_KeepsRow()
    {
        var fixture = Build(stockA: 4, soldA: 4, stockB: 10, soldB: 1);

        await Endpoint(fixture).HandleAsync(CancellationToken.None);

        fixture.StockA.Quantity.Should().Be(0);
        fixture.DbContext.Object.InventoryItems
            .Should().Contain(fixture.StockA, "an out-of-stock product must stay visible in Sklad");
    }

    [Fact]
    public async Task HandleAsync_AlreadyCompleted_ThrowsAndDoesNotDeductTwice()
    {
        var fixture = Build(stockA: 14, soldA: 4, stockB: 64, soldB: 2);
        fixture.Sale.State = SaleState.Completed;

        var act = () => Endpoint(fixture).HandleAsync(CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ErrorCodes.SaleAlreadyCompleted);

        fixture.StockA.Quantity.Should().Be(14, "completing twice must not deduct twice");
        fixture.DbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_LinePriceMissing_ThrowsAndDoesNotTouchInventory()
    {
        var fixture = Build(stockA: 14, soldA: 4, stockB: 64, soldB: 2);
        fixture.Sale.Items[1].UnitPriceWithVat = 0m;

        var act = () => Endpoint(fixture).HandleAsync(CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ErrorCodes.SaleLinePriceMissing);

        fixture.StockA.Quantity.Should().Be(14);
        fixture.DbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_SaleNotFound_Throws()
    {
        var fixture = Build(stockA: 14, soldA: 4, stockB: 64, soldB: 2);

        var act = () => Endpoint(fixture, Guid.NewGuid()).HandleAsync(CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ErrorCodes.NotfoundError);
    }
}
