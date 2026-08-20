using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Sales.Commands.Delete;
using AleTrack.Features.Sales.Commands.ConfirmPayment;
using AleTrack.Features.Sales.Commands.Update;
using AleTrack.Features.Sales.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Sales;

/// <summary>
/// The guards that keep a completed sale frozen, and the one command that is still allowed to touch
/// it. Once stock has been deducted, editing or deleting the record would leave Sklad short with
/// nothing explaining why.
/// </summary>
public sealed class SaleMutationGuardTests
{
    private static (Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> DbContext, Sale Sale, InventoryItem Stock)
        Build(SaleState state, SalePaymentMethod payment = SalePaymentMethod.Cash)
    {
        var product = ProductBuilder.BuildEntity(name: "Svijanský Máz", priceWithVat: 1850m);
        product.Id = 1;

        var stock = new InventoryItem
        {
            Id = 10, PublicId = Guid.NewGuid(), ProductId = 1, Product = product, Quantity = 9
        };

        var sale = new Sale
        {
            Id = 5,
            PublicId = Guid.NewGuid(),
            SaleDate = new DateOnly(2026, 8, 13),
            State = state,
            BuyerKind = SaleBuyerKind.Walkin,
            Payment = payment,
            Billing = payment == SalePaymentMethod.Invoice
                ? new SaleBillingDetails { Name = "Penzion Jitřenka s.r.o.", DueDate = new DateOnly(2026, 8, 28) }
                : null,
            Items =
            [
                new SaleItem
                {
                    Id = 100, PublicId = Guid.NewGuid(), SaleId = 5, InventoryItemId = stock.Id,
                    InventoryItem = stock, ProductId = 1, Name = "Svijanský Máz",
                    Quantity = 2, UnitPriceWithVat = 1850m, ListPriceWithVat = 1850m
                }
            ]
        };

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            products: [product], inventoryItems: [stock], sales: [sale], saleItems: [.. sale.Items]);

        return (dbContext, sale, stock);
    }

    private static UpdateSaleDto ValidBody(Guid stockPublicId) => new()
    {
        SaleDate = new DateOnly(2026, 8, 13),
        BuyerKind = SaleBuyerKind.Walkin,
        BuyerName = "Josef Vrána",
        Payment = SalePaymentMethod.Cash,
        Items = [new SaleItemDto { InventoryItemId = stockPublicId, Quantity = 1, UnitPriceWithVat = 1850m }]
    };

    [Fact]
    public async Task HandleAsync_UpdateCompletedSale_ThrowsAndDoesNotSave()
    {
        var (dbContext, sale, stock) = Build(SaleState.Completed);

        var endpoint = EndpointBuilder<UpdateSaleRequest, UpdateSaleEndpoint>.Create(dbContext.Object);
        var act = () => endpoint.HandleAsync(
            new UpdateSaleRequest { Id = sale.PublicId, Data = ValidBody(stock.PublicId) },
            CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ErrorCodes.SaleAlreadyCompleted);
        dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_UpdateDraftSwitchedToCash_ClearsBillingBlock()
    {
        var (dbContext, sale, stock) = Build(SaleState.Draft, SalePaymentMethod.Invoice);

        var endpoint = EndpointBuilder<UpdateSaleRequest, UpdateSaleEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(
            new UpdateSaleRequest { Id = sale.PublicId, Data = ValidBody(stock.PublicId) },
            CancellationToken.None);

        sale.Payment.Should().Be(SalePaymentMethod.Cash);
        sale.Billing.Should().BeNull("switching to cash must not leave stale billing data behind");
        dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_UpdateDraft_DoesNotTouchInventory()
    {
        var (dbContext, sale, stock) = Build(SaleState.Draft);

        var endpoint = EndpointBuilder<UpdateSaleRequest, UpdateSaleEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(
            new UpdateSaleRequest { Id = sale.PublicId, Data = ValidBody(stock.PublicId) },
            CancellationToken.None);

        stock.Quantity.Should().Be(9, "stock only moves when the sale is completed");
    }

    [Fact]
    public async Task HandleAsync_DeleteCompletedSale_ThrowsAndDoesNotSave()
    {
        var (dbContext, sale, _) = Build(SaleState.Completed);

        var endpoint = EndpointBuilder<DeleteSaleRequest, DeleteSaleEndpoint>.Create(dbContext.Object);
        var act = () => endpoint.HandleAsync(
            new DeleteSaleRequest { Id = sale.PublicId }, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ErrorCodes.SaleAlreadyCompleted);
        dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_DeleteDraftSale_Saves()
    {
        var (dbContext, sale, _) = Build(SaleState.Draft);

        var endpoint = EndpointBuilder<DeleteSaleRequest, DeleteSaleEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new DeleteSaleRequest { Id = sale.PublicId }, CancellationToken.None);

        dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_ConfirmPaymentOnAwaitingSale_CompletesItAndStampsTheDate()
    {
        var (dbContext, sale, stock) = Build(SaleState.AwaitingPayment, SalePaymentMethod.Invoice);

        var endpoint = EndpointWithoutRequestBuilder<ConfirmSalePaymentEndpoint>
            .Create(dbContext.Object, new FixedClock(new DateTimeOffset(2026, 8, 20, 9, 0, 0, TimeSpan.Zero)));
        endpoint.HttpContext.Request.RouteValues["id"] = sale.PublicId.ToString();
        await endpoint.HandleAsync(CancellationToken.None);

        sale.State.Should().Be(SaleState.Completed);
        sale.Billing!.PaidDate.Should().Be(new DateOnly(2026, 8, 20));
        stock.Quantity.Should().Be(9, "the goods left the shelf at completion, not at payment");
        dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_ConfirmPaymentOnDraft_Throws()
    {
        var (dbContext, sale, _) = Build(SaleState.Draft, SalePaymentMethod.Invoice);

        var endpoint = EndpointWithoutRequestBuilder<ConfirmSalePaymentEndpoint>
            .Create(dbContext.Object, new FixedClock(DateTimeOffset.UnixEpoch));
        endpoint.HttpContext.Request.RouteValues["id"] = sale.PublicId.ToString();
        var act = () => endpoint.HandleAsync(CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ErrorCodes.SaleNotAwaitingPayment);
        dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_ConfirmPaymentTwice_Throws()
    {
        // Already completed: a second confirmation would overwrite the settlement date.
        var (dbContext, sale, _) = Build(SaleState.Completed, SalePaymentMethod.Invoice);

        var endpoint = EndpointWithoutRequestBuilder<ConfirmSalePaymentEndpoint>
            .Create(dbContext.Object, new FixedClock(DateTimeOffset.UnixEpoch));
        endpoint.HttpContext.Request.RouteValues["id"] = sale.PublicId.ToString();
        var act = () => endpoint.HandleAsync(CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ErrorCodes.SaleNotAwaitingPayment);
    }

    [Fact]
    public async Task HandleAsync_UpdateAwaitingPaymentSale_ThrowsLikeACompletedOne()
    {
        var (dbContext, sale, stock) = Build(SaleState.AwaitingPayment, SalePaymentMethod.Invoice);

        var endpoint = EndpointBuilder<UpdateSaleRequest, UpdateSaleEndpoint>.Create(dbContext.Object);
        var act = () => endpoint.HandleAsync(
            new UpdateSaleRequest { Id = sale.PublicId, Data = ValidBody(stock.PublicId) },
            CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ErrorCodes.SaleAlreadyCompleted);
    }

    [Fact]
    public async Task HandleAsync_DeleteAwaitingPaymentSale_ThrowsLikeACompletedOne()
    {
        var (dbContext, sale, _) = Build(SaleState.AwaitingPayment, SalePaymentMethod.Invoice);

        var endpoint = EndpointBuilder<DeleteSaleRequest, DeleteSaleEndpoint>.Create(dbContext.Object);
        var act = () => endpoint.HandleAsync(
            new DeleteSaleRequest { Id = sale.PublicId }, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ErrorCodes.SaleAlreadyCompleted);
    }

    /// <summary>The injected clock, pinned so the settlement date is assertable.</summary>
    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
