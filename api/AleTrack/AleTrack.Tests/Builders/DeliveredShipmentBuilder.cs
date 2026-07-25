using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Mocks;
using Moq;

namespace AleTrack.Tests.Builders;

/// <summary>One delivered order line to seed into the fixture.</summary>
public sealed record LineSpec(ProductKind Kind, ProductType Type, double? PackageSize, int Quantity)
{
    public LineSpec(ProductKind kind, ProductType type, double packageSize, int quantity)
        : this(kind, type, (double?)packageSize, quantity) { }
}

/// <summary>The whole object graph a report test needs, plus the mocked DbContext over it.</summary>
public sealed record DeliveredShipmentFixture(
    Mock<AleTrackDbContext> DbContext,
    OutgoingShipment Shipment,
    Order Order,
    Client Client,
    Brewery Brewery,
    Driver Driver,
    List<OrderItem> OrderItems);

/// <summary>
/// Builds a single-client, single-brewery delivered shipment wired end to end
/// (shipment → order stop → order → items → products) so report handlers can traverse it.
/// </summary>
public static class DeliveredShipmentBuilder
{
    public static DeliveredShipmentFixture Build(
        DateTime deliveryDate,
        OutgoingShipmentState state,
        List<LineSpec> lines,
        Region region = Region.ZittauCity,
        OrderState orderState = OrderState.Finished,
        DateOnly? requiredDeliveryDate = null,
        DateOnly? actualDeliveryDate = null,
        List<OutgoingShipmentReturn>? returns = null,
        OutgoingShipmentStopKind stopKind = OutgoingShipmentStopKind.Order)
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Pivovar Zittau", color: "#E69F00");
        brewery.Id = 1;

        var client = ClientBuilder.BuildEntity(name: "Hospoda U Kotvy", region: region);
        client.Id = 1;

        var driver = DriverBuilder.BuildEntity(firstName: "Jan", lastName: "Novák", color: "#0072B2");
        driver.Id = 1;

        var products = new List<Product>();
        var orderItems = new List<OrderItem>();

        var order = new Order
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            Client = client,
            ClientId = client.Id,
            State = orderState,
            CreatedDate = deliveryDate.AddDays(-7),
            RequiredDeliveryDate = requiredDeliveryDate,
            ActualDeliveryDate = actualDeliveryDate
        };

        var shipment = OutgoingShipmentBuilder.BuildEntity(deliveryDate: deliveryDate, state: state);
        shipment.Id = 1;
        shipment.Returns = returns ?? [];
        shipment.Drivers = [new OutgoingShipmentDriver { DriverId = driver.Id, Driver = driver, OutgoingShipmentId = shipment.Id, OutgoingShipment = shipment }];

        var stop = new OutgoingShipmentStop
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            Kind = stopKind,
            Order = 1,
            OutgoingShipmentId = shipment.Id,
            OutgoingShipment = shipment,
            ClientOrderId = order.Id,
            ClientOrder = order
        };

        shipment.Stops = [stop];
        order.OutgoingShipmentStop = stop;
        order.OutgoingShipmentStopId = stop.Id;

        var nextId = 1L;
        foreach (var line in lines)
        {
            var product = ProductBuilder.BuildEntity(
                name: $"Produkt {nextId}",
                kind: line.Kind,
                type: line.Type,
                packageSize: line.PackageSize);
            product.Id = nextId;
            product.BreweryId = brewery.Id;
            product.Brewery = brewery;
            products.Add(product);

            orderItems.Add(new OrderItem
            {
                Id = nextId,
                PublicId = Guid.NewGuid(),
                OrderId = order.Id,
                Order = order,
                ProductId = product.Id,
                Product = product,
                Quantity = line.Quantity
            });

            nextId++;
        }

        order.OrderItems = orderItems;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            breweries: [brewery],
            products: products,
            orders: [order],
            orderItems: orderItems,
            drivers: [driver],
            outgoingShipments: [shipment]);

        return new DeliveredShipmentFixture(dbContext, shipment, order, client, brewery, driver, orderItems);
    }

    /// <summary>
    /// Adds a second client with its own order and stop on the SAME delivered shipment, and
    /// returns a fixture whose mocked DbContext sees both. Used to assert ordering and grouping.
    /// </summary>
    public static DeliveredShipmentFixture AddSecondClient(
        DeliveredShipmentFixture fixture,
        string clientName,
        Region region,
        List<LineSpec> lines)
    {
        var client = ClientBuilder.BuildEntity(name: clientName, region: region);
        client.Id = 2;

        var order = new Order
        {
            Id = 2,
            PublicId = Guid.NewGuid(),
            Client = client,
            ClientId = client.Id,
            State = OrderState.Finished,
            CreatedDate = fixture.Shipment.DeliveryDate!.Value.AddDays(-7)
        };

        var stop = new OutgoingShipmentStop
        {
            Id = 2,
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = 2,
            OutgoingShipmentId = fixture.Shipment.Id,
            OutgoingShipment = fixture.Shipment,
            ClientOrderId = order.Id,
            ClientOrder = order
        };

        order.OutgoingShipmentStop = stop;
        order.OutgoingShipmentStopId = stop.Id;
        fixture.Shipment.Stops.Add(stop);

        var products = new List<Product>();
        var orderItems = new List<OrderItem>();
        var nextId = 100L;

        foreach (var line in lines)
        {
            var product = ProductBuilder.BuildEntity(
                name: $"Produkt {nextId}",
                kind: line.Kind,
                type: line.Type,
                packageSize: line.PackageSize);
            product.Id = nextId;
            product.BreweryId = fixture.Brewery.Id;
            product.Brewery = fixture.Brewery;
            products.Add(product);

            orderItems.Add(new OrderItem
            {
                Id = nextId,
                PublicId = Guid.NewGuid(),
                OrderId = order.Id,
                Order = order,
                ProductId = product.Id,
                Product = product,
                Quantity = line.Quantity
            });

            nextId++;
        }

        order.OrderItems = orderItems;

        var allProducts = fixture.OrderItems.Select(oi => oi.Product).Concat(products).ToList();
        var allOrderItems = fixture.OrderItems.Concat(orderItems).ToList();

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [fixture.Client, client],
            breweries: [fixture.Brewery],
            products: allProducts,
            orders: [fixture.Order, order],
            orderItems: allOrderItems,
            drivers: [fixture.Driver],
            outgoingShipments: [fixture.Shipment]);

        return fixture with { DbContext = dbContext, OrderItems = allOrderItems };
    }
}
