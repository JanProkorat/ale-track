using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Sales.Commands.Create;
using AleTrack.Features.Sales.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Moq;

namespace AleTrack.Tests.Features.Sales;

/// <summary>
/// Recording a garage sale. The interesting part is the snapshot: the client sends only which stock
/// row and how many, and the server fills in the name, package size and ceník price so a completed
/// sale stays readable after the product is retired or the ceník moves.
/// </summary>
public sealed class CreateSaleTests
{
    private static Mock<IAppContext> AppContext()
    {
        var appContext = new Mock<IAppContext>();
        appContext.SetupGet(a => a.UserId).Returns((Guid?)null);
        return appContext;
    }

    private static (Product Product, InventoryItem Stock) Stocked(
        string name,
        int quantity,
        decimal priceWithVat,
        double packageSize,
        long productId,
        long stockId)
    {
        var product = ProductBuilder.BuildEntity(
            name: name, packageSize: packageSize, priceWithVat: priceWithVat);
        product.Id = productId;

        var stock = new InventoryItem
        {
            Id = stockId,
            PublicId = Guid.NewGuid(),
            ProductId = productId,
            Product = product,
            Quantity = quantity
        };

        return (product, stock);
    }

    [Fact]
    public async Task HandleAsync_WalkinCashSale_CreatesDraftWithSnapshottedLine()
    {
        var (product, stock) = Stocked("Svijanský Rytíř", 11, 1350m, 30, productId: 1, stockId: 7);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            products: [product], inventoryItems: [stock], sales: []);

        Sale? added = null;
        dbContext.Setup(c => c.Sales.Add(It.IsAny<Sale>())).Callback<Sale>(s => added = s);

        var request = new CreateSaleRequest
        {
            Data = new CreateSaleDto
            {
                SaleDate = new DateOnly(2026, 8, 13),
                BuyerKind = SaleBuyerKind.Walkin,
                BuyerName = "Josef Vrána",
                Payment = SalePaymentMethod.Cash,
                Items = [new SaleItemDto { InventoryItemId = stock.PublicId, Quantity = 2, UnitPriceWithVat = 1300m }]
            }
        };

        var endpoint = EndpointBuilder<CreateSaleRequest, CreateSaleEndpoint>
            .Create(dbContext.Object, AppContext().Object);
        await endpoint.HandleAsync(request, CancellationToken.None);

        dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

        added.Should().NotBeNull();
        added!.State.Should().Be(SaleState.Draft);
        added.Billing.Should().BeNull("a cash sale carries no billing block");
        added.BuyerName.Should().Be("Josef Vrána");
        added.ClientId.Should().BeNull();

        var line = added.Items.Should().ContainSingle().Subject;
        line.Name.Should().Be("Svijanský Rytíř");
        line.Kind.Should().Be(product.Kind, "packaging is snapshotted like the name and size");
        line.PackageSize.Should().Be(30);
        line.Quantity.Should().Be(2);
        line.UnitPriceWithVat.Should().Be(1300m);
        line.ListPriceWithVat.Should().Be(1350m, "the ceník price is snapshotted so a discount stays visible");
        line.InventoryItemId.Should().Be(7);
        line.ProductId.Should().Be(1);
    }

    [Fact]
    public async Task HandleAsync_FreeFormStockItem_SnapshotsNameWithoutListPrice()
    {
        var stock = new InventoryItem
        {
            Id = 12, PublicId = Guid.NewGuid(), ProductId = null, Name = "Vratné basy (prázdné)", Quantity = 64
        };

        var dbContext = AleTrackDbContextMockFactory.CreateMock(inventoryItems: [stock], sales: []);

        Sale? added = null;
        dbContext.Setup(c => c.Sales.Add(It.IsAny<Sale>())).Callback<Sale>(s => added = s);

        var request = new CreateSaleRequest
        {
            Data = new CreateSaleDto
            {
                SaleDate = new DateOnly(2026, 8, 13),
                BuyerKind = SaleBuyerKind.Walkin,
                Payment = SalePaymentMethod.Cash,
                Items = [new SaleItemDto { InventoryItemId = stock.PublicId, Quantity = 2, UnitPriceWithVat = 200m }]
            }
        };

        var endpoint = EndpointBuilder<CreateSaleRequest, CreateSaleEndpoint>
            .Create(dbContext.Object, AppContext().Object);
        await endpoint.HandleAsync(request, CancellationToken.None);

        var line = added!.Items.Should().ContainSingle().Subject;
        line.Name.Should().Be("Vratné basy (prázdné)");
        line.ProductId.Should().BeNull();
        line.Kind.Should().BeNull("a free-form stock item has no product to have a packaging");
        line.ListPriceWithVat.Should().BeNull("a free-form stock item has no ceník entry");
        line.UnitPriceWithVat.Should().Be(200m);
    }

    [Fact]
    public async Task HandleAsync_ValidRequest_Responds201WithTheNewId()
    {
        var (product, stock) = Stocked("Svijanský Rytíř", 11, 1350m, 30, productId: 1, stockId: 7);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            products: [product], inventoryItems: [stock], sales: []);

        var request = new CreateSaleRequest
        {
            Data = new CreateSaleDto
            {
                SaleDate = new DateOnly(2026, 8, 14),
                BuyerKind = SaleBuyerKind.Walkin,
                Payment = SalePaymentMethod.Cash,
                Items = [new SaleItemDto { InventoryItemId = stock.PublicId, Quantity = 1, UnitPriceWithVat = 1350m }]
            }
        };

        var endpoint = EndpointBuilder<CreateSaleRequest, CreateSaleEndpoint>
            .Create(dbContext.Object, AppContext().Object);
        await endpoint.HandleAsync(request, CancellationToken.None);

        // The endpoint documents 201 via Produces<string>(Status201Created), and the generated TS
        // client parses the body only on the status it was told to expect: a 200 falls through its
        // branches to `null`, so the caller loses the new id and navigates to /sales/null.
        //
        // Only the status is asserted. PublicId is assigned by PublicEntityInterceptor during a real
        // SaveChangesAsync, and the mocked DbContext runs no interceptors — asserting the id here
        // would be testing the harness rather than the endpoint.
        endpoint.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status201Created);
    }

    [Fact]
    public async Task HandleAsync_LineWithNote_StoresIt()
    {
        var (product, stock) = Stocked("Svijanský Máz", 9, 1850m, 50, productId: 1, stockId: 3);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            products: [product], inventoryItems: [stock], sales: []);

        Sale? added = null;
        dbContext.Setup(c => c.Sales.Add(It.IsAny<Sale>())).Callback<Sale>(s => added = s);

        var request = new CreateSaleRequest
        {
            Data = new CreateSaleDto
            {
                SaleDate = new DateOnly(2026, 8, 14),
                BuyerKind = SaleBuyerKind.Walkin,
                Payment = SalePaymentMethod.Cash,
                Items =
                [
                    new SaleItemDto
                    {
                        InventoryItemId = stock.PublicId,
                        Quantity = 1,
                        UnitPriceWithVat = 1850m,
                        Note = "vrátí basy v pátek"
                    }
                ]
            }
        };

        var endpoint = EndpointBuilder<CreateSaleRequest, CreateSaleEndpoint>
            .Create(dbContext.Object, AppContext().Object);
        await endpoint.HandleAsync(request, CancellationToken.None);

        added!.Items.Should().ContainSingle().Which.Note.Should().Be("vrátí basy v pátek");
    }

    [Fact]
    public async Task HandleAsync_UnknownInventoryItem_Throws()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(inventoryItems: [], sales: []);

        var request = new CreateSaleRequest
        {
            Data = new CreateSaleDto
            {
                SaleDate = new DateOnly(2026, 8, 13),
                BuyerKind = SaleBuyerKind.Walkin,
                Payment = SalePaymentMethod.Cash,
                Items = [new SaleItemDto { InventoryItemId = Guid.NewGuid(), Quantity = 1, UnitPriceWithVat = 10m }]
            }
        };

        var endpoint = EndpointBuilder<CreateSaleRequest, CreateSaleEndpoint>
            .Create(dbContext.Object, AppContext().Object);
        var act = () => endpoint.HandleAsync(request, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ErrorCodes.NotfoundError);
        dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_UnknownClient_Throws()
    {
        var (product, stock) = Stocked("Landskron Pilsner", 5, 1420m, 30, productId: 1, stockId: 9);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [], products: [product], inventoryItems: [stock], sales: []);

        var request = new CreateSaleRequest
        {
            Data = new CreateSaleDto
            {
                SaleDate = new DateOnly(2026, 8, 13),
                BuyerKind = SaleBuyerKind.Client,
                ClientId = Guid.NewGuid(),
                Payment = SalePaymentMethod.Cash,
                Items = [new SaleItemDto { InventoryItemId = stock.PublicId, Quantity = 1, UnitPriceWithVat = 1420m }]
            }
        };

        var endpoint = EndpointBuilder<CreateSaleRequest, CreateSaleEndpoint>
            .Create(dbContext.Object, AppContext().Object);
        var act = () => endpoint.HandleAsync(request, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ErrorCodes.NotfoundError);
        dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_ClientInvoiceSale_LinksClientAndStoresBillingUnpaid()
    {
        var client = ClientBuilder.BuildEntity(name: "Pivnice Na Rohu");
        client.Id = 4;
        var (product, stock) = Stocked("Landskron Pilsner", 5, 1420m, 30, productId: 1, stockId: 9);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], products: [product], inventoryItems: [stock], sales: []);

        Sale? added = null;
        dbContext.Setup(c => c.Sales.Add(It.IsAny<Sale>())).Callback<Sale>(s => added = s);

        var request = new CreateSaleRequest
        {
            Data = new CreateSaleDto
            {
                SaleDate = new DateOnly(2026, 8, 13),
                BuyerKind = SaleBuyerKind.Client,
                ClientId = client.PublicId,
                Payment = SalePaymentMethod.Invoice,
                Billing = new SaleBillingDto
                {
                    Name = "Na Rohu gastro s.r.o.",
                    CompanyId = "27412885",
                    DueDate = new DateOnly(2026, 8, 27)
                },
                Items = [new SaleItemDto { InventoryItemId = stock.PublicId, Quantity = 1, UnitPriceWithVat = 1420m }]
            }
        };

        var endpoint = EndpointBuilder<CreateSaleRequest, CreateSaleEndpoint>
            .Create(dbContext.Object, AppContext().Object);
        await endpoint.HandleAsync(request, CancellationToken.None);

        added!.ClientId.Should().Be(4);
        added.BuyerName.Should().BeNull("a client sale does not carry a walk-in name");
        added.Billing.Should().NotBeNull();
        added.Billing!.Name.Should().Be("Na Rohu gastro s.r.o.");
        added.Billing.CompanyId.Should().Be("27412885");
        added.Billing.DueDate.Should().Be(new DateOnly(2026, 8, 27));
    }

    [Fact]
    public async Task HandleAsync_InvoiceBillingOnCashSale_IsDiscarded()
    {
        var (product, stock) = Stocked("Svijanský Máz", 9, 1850m, 50, productId: 1, stockId: 3);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            products: [product], inventoryItems: [stock], sales: []);

        Sale? added = null;
        dbContext.Setup(c => c.Sales.Add(It.IsAny<Sale>())).Callback<Sale>(s => added = s);

        var request = new CreateSaleRequest
        {
            Data = new CreateSaleDto
            {
                SaleDate = new DateOnly(2026, 8, 13),
                BuyerKind = SaleBuyerKind.Walkin,
                Payment = SalePaymentMethod.Cash,
                Billing = new SaleBillingDto { Name = "Leftover from a switched payment mode" },
                Items = [new SaleItemDto { InventoryItemId = stock.PublicId, Quantity = 1, UnitPriceWithVat = 1850m }]
            }
        };

        var endpoint = EndpointBuilder<CreateSaleRequest, CreateSaleEndpoint>
            .Create(dbContext.Object, AppContext().Object);
        await endpoint.HandleAsync(request, CancellationToken.None);

        added!.Billing.Should().BeNull("stale billing data must not survive on a cash sale");
    }
}
