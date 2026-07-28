using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.InventoryItems.Commands.Create;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.InventoryItems;

/// <summary>
/// Stocking a product. The duplicate guard is the interesting part: it once
/// matched every item of a *different* product, so the first stocking on any
/// non-empty inventory failed with someone else's item id.
/// </summary>
public sealed class CreateInventoryItemTests
{
    private static Product Product(Guid publicId, long id, string name)
    {
        var product = ProductBuilder.BuildEntity(publicId: publicId, name: name);
        product.Id = id;
        return product;
    }

    [Fact]
    public async Task HandleAsync_ProductNotStockedYet_AddsItem()
    {
        var productId = Guid.NewGuid();
        var product = Product(productId, 1, "Svijanský Rytíř");
        // Another product is already stocked — it must not block this one.
        var otherItem = new InventoryItem { PublicId = Guid.NewGuid(), ProductId = 2, Quantity = 5 };

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            products: [product, Product(Guid.NewGuid(), 2, "Svijanská Desítka")],
            inventoryItems: [otherItem]);

        var request = new CreateInventoryItemRequest
        {
            Data = new CreateInventoryItemDto { ProductId = productId, Quantity = 10, Note = "první naskladnění" }
        };

        var endpoint = EndpointBuilder<CreateInventoryItemRequest, CreateInventoryItemEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(request, CancellationToken.None);

        dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_ProductAlreadyStocked_Throws()
    {
        var productId = Guid.NewGuid();
        var product = Product(productId, 1, "Svijanský Rytíř");
        var existing = new InventoryItem { PublicId = Guid.NewGuid(), ProductId = 1, Quantity = 5 };

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            products: [product],
            inventoryItems: [existing]);

        var request = new CreateInventoryItemRequest
        {
            Data = new CreateInventoryItemDto { ProductId = productId, Quantity = 10 }
        };

        var endpoint = EndpointBuilder<CreateInventoryItemRequest, CreateInventoryItemEndpoint>.Create(dbContext.Object);
        var act = () => endpoint.HandleAsync(request, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(ErrorCodes.EntityAlreadyExistError);
        dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_EmptyInventory_AddsItem()
    {
        var productId = Guid.NewGuid();
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            products: [Product(productId, 1, "Svijanský Rytíř")],
            inventoryItems: []);

        var request = new CreateInventoryItemRequest
        {
            Data = new CreateInventoryItemDto { ProductId = productId, Quantity = 10 }
        };

        var endpoint = EndpointBuilder<CreateInventoryItemRequest, CreateInventoryItemEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(request, CancellationToken.None);

        dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
