using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.InventoryItems.Commands.Update;
using AleTrack.Features.InventoryItems.Queries.List;
using AleTrack.Features.InventoryItems.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.InventoryItems;

/// <summary>
/// Stock booked in from a supplier: how it reads in the Sklad list, and what may be edited on it.
/// </summary>
public sealed class SupplierGoodStockTests
{
    private static InventoryItem GoodStock(SupplierGood good, int quantity = 3, string? note = null)
        => new() { PublicId = Guid.NewGuid(), SupplierGood = good, SupplierGoodId = good.Id, Quantity = quantity, Note = note };

    [Fact]
    public async Task List_NamesAndSizesAGoodRowFromItsCenikEntry()
    {
        var good = SupplierBuilder.BuildGood(name: "CO₂ láhev", size: "10 kg");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(inventoryItems: [GoodStock(good, quantity: 3)]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<InventorySectionDto>, GetInventoryItemsListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        var row = endpoint.Response.Should().ContainSingle().Subject
            .Items.Should().ContainSingle().Subject;

        row.Name.Should().Be("CO₂ láhev");
        row.Size.Should().Be("10 kg");
        row.SupplierGoodId.Should().Be(good.PublicId);
        row.ProductId.Should().BeNull();
        row.Quantity.Should().Be(3);
    }

    /// <summary>
    /// A row with no product falls into the catch-all section, which is where supplier goods belong —
    /// the grouping needed no change to accommodate them.
    /// </summary>
    [Fact]
    public async Task List_PutsAGoodRowInTheOstatniSection()
    {
        var good = SupplierBuilder.BuildGood(name: "CO₂ láhev");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(inventoryItems: [GoodStock(good)]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<InventorySectionDto>, GetInventoryItemsListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        var section = endpoint.Response.Should().ContainSingle().Subject;
        section.Name.Should().Be("Ostatní");
        section.Id.Should().Be(Guid.Empty);
    }

    /// <summary>
    /// A hand-written row keeps its own name — resolving the good must not have stolen that branch.
    /// </summary>
    [Fact]
    public async Task List_StillNamesAHandWrittenRow()
    {
        var manual = new InventoryItem { PublicId = Guid.NewGuid(), Name = "Ruční zápis", Quantity = 5 };
        var dbContext = AleTrackDbContextMockFactory.CreateMock(inventoryItems: [manual]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<InventorySectionDto>, GetInventoryItemsListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        var row = endpoint.Response.Should().ContainSingle().Subject
            .Items.Should().ContainSingle().Subject;

        row.Name.Should().Be("Ruční zápis");
        row.Size.Should().BeNull();
        row.SupplierGoodId.Should().BeNull();
    }

    [Fact]
    public async Task Update_CorrectingAGoodRowsQuantityAndNote_IsAllowed()
    {
        var good = SupplierBuilder.BuildGood();
        var stock = GoodStock(good, quantity: 3);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(inventoryItems: [stock]);

        var request = new UpdateInventoryItemRequest
        {
            Id = stock.PublicId,
            Data = new UpdateInventoryItemDto { Quantity = 2, Note = "jedna prázdná" }
        };

        var endpoint = EndpointBuilder<UpdateInventoryItemRequest, UpdateInventoryItemEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(request, CancellationToken.None);

        stock.Quantity.Should().Be(2);
        stock.Note.Should().Be("jedna prázdná");
        stock.SupplierGoodId.Should().Be(good.Id, "the row keeps the goods it was booked in for");
    }

    /// <summary>
    /// A row claiming to be both a product and a supplier's goods is refused by the check constraint.
    /// Rejecting it here makes that a stated 400 rather than a 500 out of the database.
    /// </summary>
    [Fact]
    public async Task Update_RepointingAGoodRowAtAProduct_IsRejected()
    {
        var good = SupplierBuilder.BuildGood();
        var stock = GoodStock(good);
        var productId = Guid.NewGuid();
        var product = ProductBuilder.BuildEntity(publicId: productId);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            products: [product],
            inventoryItems: [stock]);

        var request = new UpdateInventoryItemRequest
        {
            Id = stock.PublicId,
            Data = new UpdateInventoryItemDto { ProductId = productId, Quantity = 3 }
        };

        var endpoint = EndpointBuilder<UpdateInventoryItemRequest, UpdateInventoryItemEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(request, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>())
            .Which.ErrorCode.Should().Be(InventoryItemErrorCodes.SupplierGoodStockCannotBeRepointedError);
        stock.SupplierGoodId.Should().Be(good.Id);
    }

    /// <summary>
    /// The guard must not catch an ordinary row — assigning a product to a hand-written one is how a
    /// manual entry gets tied to the catalogue.
    /// </summary>
    [Fact]
    public async Task Update_AssigningAProductToAHandWrittenRow_IsAllowed()
    {
        var manual = new InventoryItem { PublicId = Guid.NewGuid(), Name = "Ruční zápis", Quantity = 5 };
        var productId = Guid.NewGuid();
        var product = ProductBuilder.BuildEntity(publicId: productId);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            products: [product],
            inventoryItems: [manual]);

        var request = new UpdateInventoryItemRequest
        {
            Id = manual.PublicId,
            Data = new UpdateInventoryItemDto { ProductId = productId, Quantity = 5 }
        };

        var endpoint = EndpointBuilder<UpdateInventoryItemRequest, UpdateInventoryItemEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(request, CancellationToken.None);

        manual.Product.Should().Be(product);
    }
}
