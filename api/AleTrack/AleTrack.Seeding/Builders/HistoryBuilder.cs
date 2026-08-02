using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;

namespace AleTrack.Seeding.Builders;

/// <summary>Closed-out history produced by <see cref="HistoryBuilder"/>.</summary>
internal sealed record HistoryBundle
{
    public List<Order> Orders { get; init; } = [];
    public List<OutgoingShipment> Shipments { get; init; } = [];
    public List<ProductDelivery> Deliveries { get; init; } = [];
}

/// <summary>
/// Generates months of finished delivery runs so the Reporty module has a trend to draw.
/// Separate from <see cref="OperationalDataBuilder"/>, which builds the handful of
/// current-state fixtures (one Created run, one InTransit) under quite different rules.
/// </summary>
/// <remarks>
/// Pure by design: it takes already-materialized entities and returns new ones, never touching
/// a DbContext, which is what makes it unit-testable. Randomness comes from a fixed seed so the
/// same window always yields the same data.
/// </remarks>
internal static class HistoryBuilder
{
    /// <summary>Fixed so output is reproducible and assertable in tests.</summary>
    private const int RandomSeed = 20260728;

    private const int RunsPerWeek = 5;
    private const int DeliveriesPerWeek = 2;

    /// <summary>Share of runs cancelled rather than delivered — gives the state donut a second slice.</summary>
    private const double CancelledRunShare = 0.06;

    /// <summary>Share of delivered orders that missed their required date, so on-time lands near 88%.</summary>
    private const double LateOrderShare = 0.12;

    /// <summary>Share of delivered orders handing back empties.</summary>
    private const double OrderWithReturnsShare = 0.35;

    public static HistoryBundle CreateHistory(
        IReadOnlyList<Client> clients,
        IReadOnlyList<Product> products,
        IReadOnlyList<Vehicle> vehicles,
        IReadOnlyList<Driver> drivers,
        IReadOnlyList<Brewery> breweries,
        DateOnly from,
        DateOnly to)
    {
        ArgumentOutOfRangeException.ThrowIfGreaterThan(from, to);
        if (clients.Count == 0 || products.Count == 0 || drivers.Count == 0 || vehicles.Count == 0)
            throw new ArgumentException("History needs at least one client, product, vehicle and driver.");

        var rng = new Random(RandomSeed);

        // The snapshot writer reads product.Brewery, and the seeding path builds products by
        // adding them to brewery.Products — which sets only the inverse navigation. Relying on
        // EF's fixup here would work by accident and fail silently if it ever did not: an
        // unresolved brewery snapshots as an empty name, which groups every historical line
        // under one blank brewery in the volume report. Resolve it by reference instead.
        var breweryByProduct = breweries
            .SelectMany(b => b.Products.Select(p => (Product: p, Brewery: b)))
            .ToDictionary(x => x.Product, x => x.Brewery, ReferenceEqualityComparer.Instance);

        foreach (var product in products.Where(p => p.Brewery is null))
        {
            if (breweryByProduct.TryGetValue(product, out var owner))
                product.Brewery = owner;
        }

        var orderPool = ProductPool(products);
        var clientWeights = WeightClients(clients);
        var bundle = new HistoryBundle();
        var runIndex = 0;

        for (var weekStart = from; weekStart <= to; weekStart = weekStart.AddDays(7))
        {
            var seasonal = SeasonalMultiplier(weekStart.Month);

            for (var i = 0; i < RunsPerWeek; i++)
            {
                // Weekdays only — Mon..Fri for the first five runs of a week.
                var day = weekStart.AddDays(i % 5);
                if (day > to) break;

                runIndex++;
                var cancelled = rng.NextDouble() < CancelledRunShare;

                if (cancelled)
                {
                    // Cancelling a run frees its orders back to New for reuse rather than
                    // cancelling them (UpdateOutgoingShipmentEndpoint). Seeding orders here would
                    // leave them New and unassigned months in the past, so a cancelled run gets no
                    // order stops: created, then cancelled before anything was planned onto it.
                    bundle.Shipments.Add(new OutgoingShipment
                    {
                        PublicId = Guid.NewGuid(),
                        Name = $"Vývoz {day:dd.MM.yyyy} (zrušeno)",
                        DeliveryDate = AtMidday(day),
                        CreatedDate = AtMidday(day.AddDays(-rng.Next(2, 7))),
                        State = OutgoingShipmentState.Cancelled,
                        Vehicle = vehicles[runIndex % vehicles.Count],
                        Drivers = PickDrivers(drivers, rng),
                    });
                    continue;
                }

                var stopCount = rng.Next(2, 5);
                var orders = new List<Order>(stopCount);

                for (var s = 0; s < stopCount; s++)
                {
                    var order = BuildDeliveredOrder(
                        client: clientWeights[rng.Next(clientWeights.Count)],
                        pool: orderPool,
                        day: day,
                        seasonal: seasonal,
                        rng: rng);
                    orders.Add(order);
                }

                bundle.Orders.AddRange(orders);

                var shipment = new OutgoingShipment
                {
                    PublicId = Guid.NewGuid(),
                    Name = $"Vývoz {day:dd.MM.yyyy}",
                    DeliveryDate = AtMidday(day),
                    CreatedDate = AtMidday(day.AddDays(-rng.Next(2, 7))),
                    State = OutgoingShipmentState.Delivered,
                    Vehicle = vehicles[runIndex % vehicles.Count],
                    Drivers = PickDrivers(drivers, rng),
                    Stops = BuildOrderStops(orders),
                };

                // Every generated run is Delivered, so it must carry the snapshot a real run gets
                // on its transition into Loaded. The volume reports read nothing else, so without
                // this the seeded history renders as empty.
                ShipmentContentSnapshotWriter.Apply(shipment);

                bundle.Shipments.Add(shipment);
            }

            for (var d = 0; d < DeliveriesPerWeek; d++)
            {
                var day = weekStart.AddDays(1 + d * 2);
                if (day > to) break;

                var brewery = breweries[(runIndex + d) % Math.Max(1, breweries.Count)];
                var delivery = BuildIncomingDelivery(brewery, day, vehicles, drivers, seasonal, rng);
                if (delivery is not null) bundle.Deliveries.Add(delivery);
            }
        }

        return bundle;
    }

    /// <summary>
    /// A finished order: both the required and the actual delivery date are set, because the
    /// on-time ratio in the operations report only counts orders carrying both.
    /// </summary>
    private static Order BuildDeliveredOrder(
        Client client, IReadOnlyList<Product> pool, DateOnly day, double seasonal, Random rng)
    {
        var late = rng.NextDouble() < LateOrderShare;
        var lineCount = rng.Next(2, 6);
        var items = new List<OrderItem>(lineCount);

        for (var i = 0; i < lineCount; i++)
        {
            var product = pool[rng.Next(pool.Count)];
            var baseQty = product.Kind switch
            {
                ProductKind.Keg => rng.Next(2, 12),
                ProductKind.Bottle => rng.Next(4, 25),
                ProductKind.Can => rng.Next(6, 40),
                ProductKind.Multipack => rng.Next(2, 15),
                _ => rng.Next(1, 6),
            };

            items.Add(new OrderItem
            {
                PublicId = Guid.NewGuid(),
                Product = product,
                Quantity = Math.Max(1, (int)Math.Round(baseQty * seasonal)),
            });
        }

        var order = new Order
        {
            PublicId = Guid.NewGuid(),
            Client = client,
            CreatedDate = AtMidday(day.AddDays(-rng.Next(3, 10))),
            // Late orders were required earlier than they actually arrived.
            RequiredDeliveryDate = late ? day.AddDays(-rng.Next(1, 4)) : day,
            ActualDeliveryDate = day,
            State = OrderState.Finished,
            DeliveryAddressKind = DeliveryAddressKind.Official,
            OrderItems = items,
        };

        if (rng.NextDouble() < OrderWithReturnsShare)
        {
            var returnCount = rng.Next(1, 3);
            for (var r = 0; r < returnCount; r++)
            {
                order.Returns.Add(new OrderReturn
                {
                    PublicId = Guid.NewGuid(),
                    Name = r == 0 ? "Prázdné sudy" : "Přepravky",
                    Quantity = rng.Next(1, 9),
                });
            }
        }

        return order;
    }

    private static ProductDelivery? BuildIncomingDelivery(
        Brewery brewery, DateOnly day, IReadOnlyList<Vehicle> vehicles,
        IReadOnlyList<Driver> drivers, double seasonal, Random rng)
    {
        var breweryProducts = brewery.Products.ToList();
        if (breweryProducts.Count == 0) return null;

        var itemCount = Math.Min(breweryProducts.Count, rng.Next(2, 5));
        var items = new List<DeliveryItem>(itemCount);
        for (var i = 0; i < itemCount; i++)
        {
            items.Add(new DeliveryItem
            {
                Product = breweryProducts[rng.Next(breweryProducts.Count)],
                Quantity = Math.Max(1, (int)Math.Round(rng.Next(10, 60) * seasonal)),
            });
        }

        return new ProductDelivery
        {
            PublicId = Guid.NewGuid(),
            Date = day,
            State = ProductDeliveryState.Finished,
            Note = $"Závoz {brewery.Name}",
            Vehicle = vehicles[rng.Next(vehicles.Count)],
            Drivers = [drivers[rng.Next(drivers.Count)]],
            Stops =
            [
                new DeliveryStop
                {
                    PublicId = Guid.NewGuid(),
                    Brewery = brewery,
                    Items = items,
                },
            ],
        };
    }

    /// <summary>
    /// Assigning <c>ClientOrder</c> sets the real foreign key: the relationship is one-to-one with
    /// Order as the dependent, keyed on <c>orders.outgoing_shipment_stop_id</c>. The dead
    /// <c>client_order_id</c> scalar this used to warn against setting no longer exists.
    /// </summary>
    private static List<OutgoingShipmentStop> BuildOrderStops(IReadOnlyList<Order> orders) =>
        orders
            .Select((o, i) => new OutgoingShipmentStop
            {
                PublicId = Guid.NewGuid(),
                Order = i + 1,
                Kind = OutgoingShipmentStopKind.Order,
                ClientOrder = o,
                SelectedAddressKind = DeliveryAddressKind.Official,
            })
            .ToList();

    private static List<OutgoingShipmentDriver> PickDrivers(IReadOnlyList<Driver> drivers, Random rng)
    {
        var count = Math.Min(drivers.Count, rng.Next(1, 3));
        return drivers
            .OrderBy(_ => rng.Next())
            .Take(count)
            .Select(d => new OutgoingShipmentDriver { Driver = d })
            .ToList();
    }

    /// <summary>
    /// Repeats the first few clients so a handful of large accounts dominate and the rest form a
    /// tail. Without it every client lands within noise of every other and the Klienti ranking
    /// carries no information.
    /// </summary>
    private static List<Client> WeightClients(IReadOnlyList<Client> clients)
    {
        var weighted = new List<Client>();
        for (var i = 0; i < clients.Count; i++)
        {
            var weight = i switch
            {
                0 or 1 => 6,
                2 or 3 or 4 => 3,
                _ => 1,
            };
            for (var w = 0; w < weight; w++) weighted.Add(clients[i]);
        }
        return weighted;
    }

    /// <summary>Summer runs heavier than winter, so the volume trend actually trends.</summary>
    private static double SeasonalMultiplier(int month) => month switch
    {
        5 or 6 or 7 or 8 => 1.4,
        4 or 9 => 1.1,
        3 or 10 => 0.95,
        _ => 0.8,
    };

    /// <summary>
    /// Midday UTC rather than midnight: DeliveryDate is timestamptz and the reports derive the
    /// day from it, so a midnight value can slide across a day boundary under a session offset.
    /// </summary>
    private static DateTime AtMidday(DateOnly day) =>
        day.ToDateTime(new TimeOnly(12, 0), DateTimeKind.Utc);

    private static List<Product> ProductPool(IReadOnlyList<Product> products)
    {
        // Spread across kinds and breweries so volume-by-brewery and volume-by-kind both have shape.
        var pool = products
            .GroupBy(p => p.BreweryId)
            .SelectMany(byBrewery => byBrewery
                .GroupBy(p => p.Kind)
                .SelectMany(byKind => byKind.Take(4)))
            .ToList();

        return pool.Count > 0 ? pool : products.ToList();
    }
}
