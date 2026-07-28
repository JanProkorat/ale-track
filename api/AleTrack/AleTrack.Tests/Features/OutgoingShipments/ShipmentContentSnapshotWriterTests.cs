using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Builds the rows the run owns. Everything the volume reports later read comes from here, so
/// the values are asserted field by field rather than by count.
/// </summary>
public sealed class ShipmentContentSnapshotWriterTests
{
    [Fact]
    public void Apply_CopiesProductAndBreweryFactsOntoTheStop()
    {
        var f = Fixture();

        ShipmentContentSnapshotWriter.Apply(f.Shipment);

        var item = f.Shipment.Stops.Single().Items.Should().ContainSingle().Subject;
        item.ProductName.Should().Be("Albrecht 12°");
        item.Kind.Should().Be(ProductKind.Bottle);
        item.Type.Should().Be(ProductType.PaleLager);
        item.PackageSize.Should().Be(0.5);
        item.UnitsPerPackage.Should().Be(20);
        item.Quantity.Should().Be(6);
        item.UnitPriceWithVat.Should().Be(11.49m);
        item.UnitPriceWithoutVat.Should().Be(9.50m);
        item.BreweryName.Should().Be("Pivovar Zittau");
        item.BreweryPublicId.Should().Be(f.Brewery.PublicId);
        item.OrderItemId.Should().Be(f.Item.Id, "provenance is kept even though nothing reads it");
        item.ProductId.Should().Be(f.Product.Id);
    }

    [Fact]
    public void Apply_CopiesClientAttributionOntoTheStop()
    {
        var f = Fixture();

        ShipmentContentSnapshotWriter.Apply(f.Shipment);

        var stop = f.Shipment.Stops.Single();
        stop.ClientPublicId.Should().Be(f.Client.PublicId);
        stop.ClientName.Should().Be("Hospoda U Kotvy");
        stop.ClientRegion.Should().Be(Region.ZittauCity);
    }

    /// <summary>
    /// Editing the product afterwards must not reach back into the snapshot. This is the whole
    /// point of the table.
    /// </summary>
    [Fact]
    public void Apply_SnapshotIsIndependentOfLaterProductEdits()
    {
        var f = Fixture();
        ShipmentContentSnapshotWriter.Apply(f.Shipment);

        f.Product.Name = "Přejmenováno";
        f.Product.PriceWithVat = 99m;
        f.Product.PackageSize = 10;

        var item = f.Shipment.Stops.Single().Items.Single();
        item.ProductName.Should().Be("Albrecht 12°");
        item.UnitPriceWithVat.Should().Be(11.49m);
        item.PackageSize.Should().Be(0.5);
    }

    [Fact]
    public void Apply_IsIdempotent_ReplacingRatherThanAppending()
    {
        var f = Fixture();

        ShipmentContentSnapshotWriter.Apply(f.Shipment);
        ShipmentContentSnapshotWriter.Apply(f.Shipment);

        f.Shipment.Stops.Single().Items.Should().HaveCount(1);
    }

    [Fact]
    public void Apply_SkipsCustomStops()
    {
        var f = Fixture();
        f.Shipment.Stops.Add(new OutgoingShipmentStop
        {
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Custom,
            Order = 2,
            Label = "Čerpací stanice",
            Latitude = 49.2m,
            Longitude = 16.6m
        });

        ShipmentContentSnapshotWriter.Apply(f.Shipment);

        var custom = f.Shipment.Stops.Single(s => s.Kind == OutgoingShipmentStopKind.Custom);
        custom.Items.Should().BeEmpty();
        custom.ClientName.Should().BeNull();
    }

    /// <summary>
    /// A retired product must still snapshot: it is precisely the case the reports have to
    /// survive, and part A made retirement the normal way products leave the price list.
    /// </summary>
    [Fact]
    public void Apply_SnapshotsARetiredProduct()
    {
        var f = Fixture();
        f.Product.IsDeleted = true;

        ShipmentContentSnapshotWriter.Apply(f.Shipment);

        f.Shipment.Stops.Single().Items.Single().ProductName.Should().Be("Albrecht 12°");
    }

    [Fact]
    public void Clear_RemovesItemsAndClientAttribution()
    {
        var f = Fixture();
        ShipmentContentSnapshotWriter.Apply(f.Shipment);

        ShipmentContentSnapshotWriter.Clear(f.Shipment);

        var stop = f.Shipment.Stops.Single();
        stop.Items.Should().BeEmpty();
        stop.ClientPublicId.Should().BeNull();
        stop.ClientName.Should().BeNull();
        stop.ClientRegion.Should().BeNull();
    }

    private sealed record Graph(
        OutgoingShipment Shipment, Client Client, Brewery Brewery, Product Product, OrderItem Item);

    private static Graph Fixture()
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Pivovar Zittau", color: "#E69F00");
        brewery.Id = 1;

        var client = ClientBuilder.BuildEntity(
            name: "Hospoda U Kotvy",
            region: Region.ZittauCity,
            officialAddress: AddressBuilder.BuildEntity());
        client.Id = 1;

        var product = ProductBuilder.BuildEntity(
            name: "Albrecht 12°",
            kind: ProductKind.Bottle,
            type: ProductType.PaleLager,
            packageSize: 0.5,
            priceWithVat: 11.49m);
        product.Id = 41;
        product.UnitsPerPackage = 20;
        product.PriceWithoutVat = 9.50m;
        product.Brewery = brewery;
        product.BreweryId = brewery.Id;

        var item = new OrderItem
        {
            Id = 51,
            PublicId = Guid.NewGuid(),
            Product = product,
            ProductId = product.Id,
            Quantity = 6
        };

        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client, orderItems: [item]);
        order.Id = 101;

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            deliveryDate: DateTime.UtcNow.AddDays(1),
            state: OutgoingShipmentState.Created,
            stops:
            [
                new OutgoingShipmentStop
                {
                    PublicId = Guid.NewGuid(),
                    Kind = OutgoingShipmentStopKind.Order,
                    Order = 1,
                    ClientOrder = order
                }
            ]);

        return new Graph(shipment, client, brewery, product, item);
    }
}
