using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.InventoryItems.Queries.List;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.InventoryItems;

/// <summary>
/// What the Sklad list says about a row's packaging. The till's catalog groups by name, so two
/// trays of the same can share a card and are told apart by their count alone.
/// </summary>
public sealed class InventoryPackagingTests
{
    private static InventoryItem ProductStock(Product product, int quantity = 3)
        => new() { PublicId = Guid.NewGuid(), Product = product, ProductId = product.Id, Quantity = quantity };

    [Fact]
    public async Task List_CarriesUnitsPerPackage_SoTwoTraysOfTheSameCanAreDistinguishable()
    {
        var brewery = BreweryBuilder.BuildEntity(
            publicId: Guid.NewGuid(), officialAddress: AddressBuilder.BuildEntity());

        var tray12 = ProductBuilder.BuildEntity(
            publicId: Guid.NewGuid(), name: "Svijanský Máz", packageSize: 0.5,
            container: ProductContainer.Can, saleUnit: ProductSaleUnit.Tray, unitsPerPackage: 12);
        tray12.Id = 1;
        tray12.Brewery = brewery;

        var tray24 = ProductBuilder.BuildEntity(
            publicId: Guid.NewGuid(), name: "Svijanský Máz", packageSize: 0.5,
            container: ProductContainer.Can, saleUnit: ProductSaleUnit.Tray, unitsPerPackage: 24);
        tray24.Id = 2;
        tray24.Brewery = brewery;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            breweries: [brewery],
            products: [tray12, tray24],
            inventoryItems: [ProductStock(tray12), ProductStock(tray24)]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<InventorySectionDto>, GetInventoryItemsListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        var items = endpoint.Response.Should().ContainSingle().Subject.Items;
        items.Should().HaveCount(2);
        items.Select(i => i.UnitsPerPackage).Should().BeEquivalentTo([12, 24]);
    }

    /// <summary>
    /// A row with no product has no packaging to report — the projection must not invent one.
    /// </summary>
    [Fact]
    public async Task List_LeavesUnitsPerPackageNullOnAHandWrittenRow()
    {
        var manual = new InventoryItem { PublicId = Guid.NewGuid(), Name = "Ruční zápis", Quantity = 5 };
        var dbContext = AleTrackDbContextMockFactory.CreateMock(inventoryItems: [manual]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<InventorySectionDto>, GetInventoryItemsListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        var row = endpoint.Response.Should().ContainSingle().Subject
            .Items.Should().ContainSingle().Subject;

        row.UnitsPerPackage.Should().BeNull();
    }
}
