using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Features.ProductDeliveries.Utils;
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
    List<OrderItem> OrderItems,
    List<OutgoingShipmentStopItem> StopItems);

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
        List<OrderReturn>? returns = null,
        OutgoingShipmentStopKind stopKind = OutgoingShipmentStopKind.Order)
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Pivovar Zittau", color: "#E69F00");
        brewery.Id = 1;

        var client = ClientBuilder.BuildEntity(name: "Hospoda U Kotvy", region: region);
        client.Id = 1;

        var driver = DriverBuilder.BuildEntity(firstName: "Jan", lastName: "Novák", color: "#0072B2");
        driver.Id = 1;

        var order = new Order
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            Client = client,
            ClientId = client.Id,
            State = orderState,
            CreatedDate = deliveryDate.AddDays(-7),
            RequiredDeliveryDate = requiredDeliveryDate,
            ActualDeliveryDate = actualDeliveryDate,
            // Returns hang off the order now, and the run reaches them through its stops.
            Returns = returns ?? []
        };

        var shipment = OutgoingShipmentBuilder.BuildEntity(deliveryDate: deliveryDate, state: state);
        shipment.Id = 1;
        shipment.Drivers = [new OutgoingShipmentDriver { DriverId = driver.Id, Driver = driver, OutgoingShipmentId = shipment.Id, OutgoingShipment = shipment }];

        var stop = new OutgoingShipmentStop
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            Kind = stopKind,
            Order = 1,
            OutgoingShipmentId = shipment.Id,
            OutgoingShipment = shipment,
            ClientOrder = order
        };

        shipment.Stops = [stop];
        order.OutgoingShipmentStop = stop;
        order.OutgoingShipmentStopId = stop.Id;

        var (products, orderItems) = BuildLines(order, brewery, startId: 1, lines);
        order.OrderItems = orderItems;

        var stopItems = SnapshotAll(shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            breweries: [brewery],
            products: products,
            orders: [order],
            orderItems: orderItems,
            drivers: [driver],
            outgoingShipments: [shipment],
            outgoingShipmentStopItems: stopItems);

        return new DeliveredShipmentFixture(dbContext, shipment, order, client, brewery, driver, orderItems, stopItems);
    }

    /// <summary>
    /// Adds a second client with its own order and stop on the SAME delivered shipment, and
    /// returns a fixture whose mocked DbContext sees both. Used to assert ordering and grouping.
    /// </summary>
    /// <remarks>
    /// This consumes <paramref name="fixture"/>: it mutates <c>fixture.Shipment.Stops</c> in
    /// place (adding the second stop), but the returned fixture is the only one whose
    /// <c>DbContext</c> actually sees the second order/item. Callers must use the returned
    /// fixture, not the original — the original's <c>DbContext</c> mock still only knows about
    /// order 1, even though its <c>Shipment.Stops</c> now (confusingly) has two entries.
    /// </remarks>
    public static DeliveredShipmentFixture AddSecondClient(
        DeliveredShipmentFixture fixture,
        string clientName,
        Region region,
        List<LineSpec> lines)
    {
        var client = ClientBuilder.BuildEntity(name: clientName, region: region);
        // Derived, not hardcoded: chaining this with AddSecondStopForSameClient on one fixture
        // must not yield duplicate ids — see the id-collision finding on DeliveredShipmentBuilder.
        // The stop count grows monotonically across the whole fixture, so it is safe to reuse as
        // the shared id source for the client/order/stop triple added in this call.
        var nextStopId = fixture.Shipment.Stops.Count + 1;
        client.Id = nextStopId;

        var order = new Order
        {
            Id = nextStopId,
            PublicId = Guid.NewGuid(),
            Client = client,
            ClientId = client.Id,
            State = OrderState.Finished,
            CreatedDate = fixture.Shipment.DeliveryDate!.Value.AddDays(-7)
        };

        var stop = new OutgoingShipmentStop
        {
            Id = nextStopId,
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = nextStopId,
            OutgoingShipmentId = fixture.Shipment.Id,
            OutgoingShipment = fixture.Shipment,
            ClientOrder = order
        };

        order.OutgoingShipmentStop = stop;
        order.OutgoingShipmentStopId = stop.Id;
        fixture.Shipment.Stops.Add(stop);

        var nextItemStartId = 100 + fixture.OrderItems.Count;
        var (products, orderItems) = BuildLines(order, fixture.Brewery, startId: nextItemStartId, lines);
        order.OrderItems = orderItems;

        var allProducts = fixture.OrderItems.Select(oi => oi.Product).Concat(products).ToList();
        var allOrderItems = fixture.OrderItems.Concat(orderItems).ToList();

        var stopItems = SnapshotAll(fixture.Shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [fixture.Client, client],
            breweries: [fixture.Brewery],
            products: allProducts,
            orders: [fixture.Order, order],
            orderItems: allOrderItems,
            drivers: [fixture.Driver],
            outgoingShipments: [fixture.Shipment],
            outgoingShipmentStopItems: stopItems);

        return fixture with { DbContext = dbContext, OrderItems = allOrderItems, StopItems = stopItems };
    }

    /// <summary>
    /// Adds a second order and stop for the SAME client on the SAME delivered shipment (so on
    /// the same delivery date), and returns a fixture whose mocked DbContext sees both. Used to
    /// pin that a report's "Deliveries" counts distinct delivered <em>stops</em>, not distinct
    /// delivery <em>dates</em> — two stops sharing one date must still count as 2.
    /// </summary>
    /// <remarks>
    /// Consumes <paramref name="fixture"/> the same way <see cref="AddSecondClient"/> does:
    /// callers must use the returned fixture, not the original.
    /// </remarks>
    public static DeliveredShipmentFixture AddSecondStopForSameClient(
        DeliveredShipmentFixture fixture,
        List<LineSpec> lines,
        DateOnly? requiredDeliveryDate = null,
        DateOnly? actualDeliveryDate = null)
    {
        // Derived, not hardcoded — see the id-collision finding on DeliveredShipmentBuilder:
        // chaining this with AddSecondClient on one fixture must not yield duplicate ids.
        var nextStopId = fixture.Shipment.Stops.Count + 1;

        var order = new Order
        {
            Id = nextStopId,
            PublicId = Guid.NewGuid(),
            Client = fixture.Client,
            ClientId = fixture.Client.Id,
            State = OrderState.Finished,
            CreatedDate = fixture.Shipment.DeliveryDate!.Value.AddDays(-7),
            RequiredDeliveryDate = requiredDeliveryDate,
            ActualDeliveryDate = actualDeliveryDate
        };

        var stop = new OutgoingShipmentStop
        {
            Id = nextStopId,
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = nextStopId,
            OutgoingShipmentId = fixture.Shipment.Id,
            OutgoingShipment = fixture.Shipment,
            ClientOrder = order
        };

        order.OutgoingShipmentStop = stop;
        order.OutgoingShipmentStopId = stop.Id;
        fixture.Shipment.Stops.Add(stop);

        var nextItemStartId = 100 + fixture.OrderItems.Count;
        var (products, orderItems) = BuildLines(order, fixture.Brewery, startId: nextItemStartId, lines);
        order.OrderItems = orderItems;

        var allProducts = fixture.OrderItems.Select(oi => oi.Product).Concat(products).ToList();
        var allOrderItems = fixture.OrderItems.Concat(orderItems).ToList();

        var stopItems = SnapshotAll(fixture.Shipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [fixture.Client],
            breweries: [fixture.Brewery],
            products: allProducts,
            orders: [fixture.Order, order],
            orderItems: allOrderItems,
            drivers: [fixture.Driver],
            outgoingShipments: [fixture.Shipment],
            outgoingShipmentStopItems: stopItems);

        return fixture with { DbContext = dbContext, OrderItems = allOrderItems, StopItems = stopItems };
    }

    /// <summary>
    /// Appends a second, independent <see cref="OutgoingShipment"/> — its own id, state, stop,
    /// order, lines and returns — alongside <paramref name="fixture"/>'s original shipment. Used
    /// to pin that a shipment-scoped aggregate (e.g. <c>ReturnableUnits</c>) only counts the
    /// shipments in the state it claims to, not every shipment the mocked DbContext knows about.
    /// </summary>
    /// <remarks>
    /// Consumes <paramref name="fixture"/> the same way <see cref="AddSecondClient"/> does:
    /// callers must use the returned fixture, not the original. <c>fixture.Shipment</c> on the
    /// returned fixture still refers to the original (first) shipment.
    /// </remarks>
    public static DeliveredShipmentFixture AddSecondShipment(
        DeliveredShipmentFixture fixture,
        DateTime deliveryDate,
        OutgoingShipmentState state,
        List<LineSpec> lines,
        List<OrderReturn>? returns = null)
    {
        // A high, fixed id band keeps this second shipment's ids clear of anything the other
        // Add* helpers derive from fixture.Shipment.Stops.Count / fixture.OrderItems.Count.
        const long secondShipmentId = 2;
        const long secondOrderStopId = 900;

        var secondShipment = OutgoingShipmentBuilder.BuildEntity(deliveryDate: deliveryDate, state: state);
        secondShipment.Id = secondShipmentId;
        secondShipment.Drivers = [];

        var order = new Order
        {
            Id = secondOrderStopId,
            PublicId = Guid.NewGuid(),
            Client = fixture.Client,
            ClientId = fixture.Client.Id,
            State = OrderState.Finished,
            CreatedDate = deliveryDate.AddDays(-7),
            Returns = returns ?? []
        };

        var stop = new OutgoingShipmentStop
        {
            Id = secondOrderStopId,
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = 1,
            OutgoingShipmentId = secondShipment.Id,
            OutgoingShipment = secondShipment,
            ClientOrder = order
        };

        order.OutgoingShipmentStop = stop;
        order.OutgoingShipmentStopId = stop.Id;
        secondShipment.Stops = [stop];

        var nextItemStartId = secondOrderStopId + fixture.OrderItems.Count;
        var (products, orderItems) = BuildLines(order, fixture.Brewery, startId: nextItemStartId, lines);
        order.OrderItems = orderItems;

        var allProducts = fixture.OrderItems.Select(oi => oi.Product).Concat(products).ToList();
        var allOrderItems = fixture.OrderItems.Concat(orderItems).ToList();

        var stopItems = SnapshotAll(fixture.Shipment, secondShipment);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [fixture.Client],
            breweries: [fixture.Brewery],
            products: allProducts,
            orders: [fixture.Order, order],
            orderItems: allOrderItems,
            drivers: [fixture.Driver],
            outgoingShipments: [fixture.Shipment, secondShipment],
            outgoingShipmentStopItems: stopItems);

        return fixture with { DbContext = dbContext, OrderItems = allOrderItems, StopItems = stopItems };
    }

    /// <summary>
    /// Adds one incoming product delivery (Dovoz) in the same fixture so the incoming-vs-outgoing
    /// series has something on the incoming side.
    /// </summary>
    public static DeliveredShipmentFixture WithIncomingDelivery(
        DeliveredShipmentFixture fixture,
        DateOnly date,
        ProductKind kind,
        double packageSize,
        int quantity,
        ProductDeliveryState state = ProductDeliveryState.Finished)
    {
        var product = ProductBuilder.BuildEntity(
            name: "Dovezený produkt",
            kind: kind,
            type: ProductType.PaleLager,
            packageSize: packageSize);
        product.Id = 500;
        product.BreweryId = fixture.Brewery.Id;
        product.Brewery = fixture.Brewery;

        var delivery = new ProductDelivery
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            Date = date,
            State = state
        };

        var stop = new DeliveryStop
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            DeliveryId = delivery.Id,
            Delivery = delivery,
            Order = 1,
            Kind = DeliveryStopKind.Brewery,
            BreweryId = fixture.Brewery.Id
        };

        var item = new DeliveryItem
        {
            Id = 1,
            DeliveryStopId = stop.Id,
            DeliveryStop = stop,
            ProductId = product.Id,
            Product = product,
            Quantity = quantity
        };

        // Booking a line in records the product's weight inputs; the report reads nothing else.
        DeliveryItemSnapshot.Apply(item, product);

        stop.Items = [item];
        delivery.Stops = [stop];

        var allProducts = fixture.OrderItems.Select(oi => oi.Product).Append(product).ToList();

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [fixture.Client],
            breweries: [fixture.Brewery],
            products: allProducts,
            orders: [fixture.Order],
            orderItems: fixture.OrderItems,
            drivers: [fixture.Driver],
            productDeliveries: [delivery],
            deliveryItems: [item],
            outgoingShipments: [fixture.Shipment],
            // The outgoing side must stay visible: this re-mocks the whole context.
            outgoingShipmentStopItems: fixture.StopItems);

        return fixture with { DbContext = dbContext };
    }

    /// <summary>
    /// Populates snapshotted content on every stop of every given shipment, the same way
    /// production does, by running the real writer. Using the writer rather than hand-built rows
    /// keeps the fixture from drifting away from what a loaded run actually stores.
    /// </summary>
    /// <remarks>
    /// Takes every shipment and returns every row, because <c>Apply</c> rebuilds a whole
    /// shipment's stops rather than appending to one: calling it after a second stop has been
    /// added re-snapshots the first as well. Accumulating the return value across calls would
    /// therefore double-count, so callers pass the result straight to <c>CreateMock</c>.
    /// </remarks>
    private static List<OutgoingShipmentStopItem> SnapshotAll(params OutgoingShipment[] shipments)
    {
        var items = new List<OutgoingShipmentStopItem>();

        foreach (var shipment in shipments)
        {
            ShipmentContentSnapshotWriter.Apply(shipment);
            items.AddRange(shipment.Stops.SelectMany(s => s.Items));
        }

        // The report projection navigates si.Stop and groups by si.StopId, so both need to be
        // real on a mocked DbSet.
        var nextId = 1000L;
        foreach (var item in items)
        {
            item.Id = nextId++;
            item.StopId = item.Stop.Id;
        }

        return items;
    }

    /// <summary>
    /// Builds products and order items for <paramref name="order"/> from <paramref name="lines"/>,
    /// assigning sequential ids starting at <paramref name="startId"/>. Shared by every fixture
    /// path that wires a set of order lines onto an order (<see cref="Build"/>,
    /// <see cref="AddSecondClient"/>, <see cref="AddSecondStopForSameClient"/>).
    /// </summary>
    private static (List<Product> Products, List<OrderItem> OrderItems) BuildLines(
        Order order, Brewery brewery, long startId, List<LineSpec> lines)
    {
        var products = new List<Product>();
        var orderItems = new List<OrderItem>();
        var nextId = startId;

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

        return (products, orderItems);
    }
}
