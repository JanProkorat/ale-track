using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Seeding.Builders;

/// <summary>
/// Builds a coherent set of demo "operational" data (vehicles, drivers, inventory,
/// orders, outgoing shipments and incoming product deliveries) on top of the
/// seeded breweries/products/clients, so every module has something to show.
/// </summary>
internal static class OperationalDataBuilder
{
    public static List<Vehicle> CreateVehicles() =>
    [
        new() { PublicId = Guid.NewGuid(), Name = "Dodávka Iveco Daily", MaxWeight = 1200 },
        new() { PublicId = Guid.NewGuid(), Name = "Ford Transit", MaxWeight = 1000 },
        new() { PublicId = Guid.NewGuid(), Name = "MAN TGL 8.190", MaxWeight = 3500 },
    ];

    public static List<Driver> CreateDrivers() =>
    [
        new() { PublicId = Guid.NewGuid(), FirstName = "Petr", LastName = "Novák", PhoneNumber = "+420 601 111 222", Color = "#F08C00" },
        new() { PublicId = Guid.NewGuid(), FirstName = "Martin", LastName = "Svoboda", PhoneNumber = "+420 602 333 444", Color = "#1A73E8" },
        new() { PublicId = Guid.NewGuid(), FirstName = "Jana", LastName = "Dvořáková", PhoneNumber = "+420 603 555 666", Color = "#2E9E5B" },
    ];

    /// <summary>Stock on hand — a spread of products across breweries and kinds.</summary>
    public static List<InventoryItem> CreateInventory(IReadOnlyList<Product> products)
    {
        var pick = InventoryPool(products);
        var quantities = new[] { 48, 120, 30, 12, 60, 24, 200, 18, 90, 36, 15, 72 };
        return pick
            .Select((p, i) => new InventoryItem
            {
                PublicId = Guid.NewGuid(),
                Product = p,
                Quantity = quantities[i % quantities.Length],
            })
            .ToList();
    }

    /// <summary>Ten orders across the clients; all start as New (free) — shipment
    /// assignment and historical completion flip states afterwards.</summary>
    public static List<Order> CreateOrders(IReadOnlyList<Client> clients, IReadOnlyList<Product> products)
    {
        var pool = OrderPool(products);
        Product P(int i) => pool[i % pool.Count];

        OrderItem Item(Product p, int qty) => new() { PublicId = Guid.NewGuid(), Product = p, Quantity = qty };

        Order Make(int clientIdx, int daysAgo, List<OrderItem> items) => new()
        {
            PublicId = Guid.NewGuid(),
            Client = clients[clientIdx % clients.Count],
            CreatedDate = DateTime.UtcNow.AddDays(-daysAgo),
            RequiredDeliveryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(4)),
            State = OrderState.New,
            OrderItems = items,
        };

        return
        [
            Make(0, 6, [Item(P(0), 10), Item(P(1), 6), Item(P(7), 24)]),
            Make(1, 6, [Item(P(2), 4), Item(P(8), 12)]),
            Make(2, 5, [Item(P(3), 8), Item(P(9), 20), Item(P(4), 5)]),
            Make(3, 5, [Item(P(5), 15), Item(P(10), 6)]),
            Make(4, 4, [Item(P(6), 10), Item(P(11), 30)]),
            Make(5, 4, [Item(P(0), 5), Item(P(3), 5), Item(P(12), 18)]),
            Make(6, 3, [Item(P(1), 12), Item(P(13), 8)]),
            Make(7, 3, [Item(P(2), 6), Item(P(4), 6), Item(P(9), 10)]),
            Make(0, 12, [Item(P(5), 20), Item(P(6), 10)]),
            Make(2, 14, [Item(P(7), 40), Item(P(8), 15)]),
        ];
    }

    /// <summary>A shipment in the initial "Created" state with a from-stock dokládka;
    /// its orders are moved into Planning (mirrors the create endpoint).</summary>
    public static OutgoingShipment CreateShipmentCreated(
        string name, IReadOnlyList<Order> orders, Vehicle vehicle, IReadOnlyList<Driver> drivers, Product dokladkaProduct)
    {
        foreach (var order in orders.Where(o => o.State == OrderState.New))
            order.State = OrderState.Planning;

        return new OutgoingShipment
        {
            PublicId = Guid.NewGuid(),
            Name = name,
            DeliveryDate = DateTime.UtcNow.AddDays(2),
            Vehicle = vehicle,
            State = OutgoingShipmentState.Created,
            Drivers = drivers.Select(d => new OutgoingShipmentDriver { Driver = d }).ToList(),
            Stops = BuildStops(orders),
            InventoryExtraItems =
            [
                new OutgoingShipmentInventoryExtraItem
                {
                    PublicId = Guid.NewGuid(),
                    Product = dokladkaProduct,
                    Quantity = 6,
                    IsShipmentLoadingConfirmed = false,
                    FirstInvoiceQuantity = 6,
                    SecondInvoiceQuantity = 0,
                },
            ],
        };
    }

    /// <summary>A shipment already on the road; its orders move into Delivering.</summary>
    public static OutgoingShipment CreateShipmentInTransit(
        string name, IReadOnlyList<Order> orders, Vehicle vehicle, IReadOnlyList<Driver> drivers)
    {
        foreach (var order in orders)
            order.State = OrderState.Delivering;

        return new OutgoingShipment
        {
            PublicId = Guid.NewGuid(),
            Name = name,
            DeliveryDate = DateTime.UtcNow.AddDays(-1),
            Vehicle = vehicle,
            State = OutgoingShipmentState.InTransit,
            Drivers = drivers.Select(d => new OutgoingShipmentDriver { Driver = d }).ToList(),
            Stops = BuildStops(orders),
        };
    }

    /// <summary>Two incoming deliveries (Dovozy): one finished, one in planning.</summary>
    public static List<ProductDelivery> CreateDeliveries(
        IReadOnlyList<Brewery> breweries, IReadOnlyList<Product> products, IReadOnlyList<Vehicle> vehicles, IReadOnlyList<Driver> drivers)
    {
        DeliveryItem DItem(Product p, int qty) => new() { Product = p, Quantity = qty };

        Product FromBrewery(Brewery b, int skip) => b.Products.ElementAt(skip % Math.Max(1, b.Products.Count));

        var svijany = breweries[0];
        var rohozec = breweries[1];

        return
        [
            new ProductDelivery
            {
                PublicId = Guid.NewGuid(),
                Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)),
                State = ProductDeliveryState.Finished,
                Note = "Pravidelný závoz Svijany",
                Vehicle = vehicles[2],
                Drivers = [drivers[0]],
                Stops =
                [
                    new DeliveryStop
                    {
                        PublicId = Guid.NewGuid(),
                        Brewery = svijany,
                        Items = [DItem(FromBrewery(svijany, 0), 40), DItem(FromBrewery(svijany, 3), 24)],
                    },
                ],
            },
            new ProductDelivery
            {
                PublicId = Guid.NewGuid(),
                Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
                State = ProductDeliveryState.InPlanning,
                Note = "Doplnění skladu Rohozec",
                Vehicle = vehicles[0],
                Drivers = [drivers[1]],
                Stops =
                [
                    new DeliveryStop
                    {
                        PublicId = Guid.NewGuid(),
                        Brewery = rohozec,
                        Items = [DItem(FromBrewery(rohozec, 0), 30), DItem(FromBrewery(rohozec, 2), 12)],
                    },
                ],
            },
        ];
    }

    private static List<OutgoingShipmentStop> BuildStops(IReadOnlyList<Order> orders) =>
        orders
            .Select((o, i) => new OutgoingShipmentStop
            {
                PublicId = Guid.NewGuid(),
                Order = i + 1,
                ClientOrder = o,
                SelectedAddressKind = OutgoingShipmentStopAddressKind.Official,
            })
            .ToList();

    private static List<Product> InventoryPool(IReadOnlyList<Product> products)
    {
        var kegs = products.Where(p => p.Kind == ProductKind.Keg).Take(5);
        var bottles = products.Where(p => p.Kind == ProductKind.Bottle).Take(4);
        var cans = products.Where(p => p.Kind == ProductKind.Can).Take(3);
        return kegs.Concat(bottles).Concat(cans).ToList();
    }

    private static List<Product> OrderPool(IReadOnlyList<Product> products)
    {
        var kegs = products.Where(p => p.Kind == ProductKind.Keg).Take(6);
        var bottles = products.Where(p => p.Kind == ProductKind.Bottle).Take(6);
        var cans = products.Where(p => p.Kind == ProductKind.Can).Take(4);
        var pool = kegs.Concat(bottles).Concat(cans).ToList();
        return pool.Count > 0 ? pool : products.Take(10).ToList();
    }
}
