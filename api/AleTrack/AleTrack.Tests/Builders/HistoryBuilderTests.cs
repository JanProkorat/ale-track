using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;
using AleTrack.Seeding.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Builders;

/// <summary>
/// Guards the invariants the Reporty module depends on. Every one of these corresponds to a
/// condition in a report query — break it and a tab silently renders empty rather than failing.
/// </summary>
public sealed class HistoryBuilderTests
{
    private static readonly DateOnly From = new(2026, 1, 1);
    private static readonly DateOnly To = new(2026, 7, 27);

    private static HistoryBundle Build(DateOnly? from = null, DateOnly? to = null)
    {
        var breweries = Breweries();
        return HistoryBuilder.CreateHistory(
            Clients(),
            breweries.SelectMany(b => b.Products).ToList(),
            Vehicles(),
            Drivers(),
            breweries,
            from ?? From,
            to ?? To);
    }

    [Fact]
    public void CreateHistory_IsDeterministic()
    {
        var a = Build();
        var b = Build();

        // Same seed, same window — a changed generator should surface as a failing test, not as
        // silently different dev data.
        b.Shipments.Count.Should().Be(a.Shipments.Count);
        b.Orders.Count.Should().Be(a.Orders.Count);
        b.Orders.Sum(o => o.OrderItems.Count).Should().Be(a.Orders.Sum(o => o.OrderItems.Count));
        b.Orders.Sum(o => o.Returns.Count).Should().Be(a.Orders.Sum(o => o.Returns.Count));
        b.Deliveries.Count.Should().Be(a.Deliveries.Count);
    }

    [Fact]
    public void CreateHistory_ProducesEnoughDataForEveryTab()
    {
        var bundle = Build();

        bundle.Shipments.Should().HaveCountGreaterThan(100);
        bundle.Orders.Should().HaveCountGreaterThan(250);
        bundle.Orders.Sum(o => o.OrderItems.Count).Should().BeGreaterThan(800);
        bundle.Deliveries.Should().HaveCountGreaterThan(40);
    }

    [Fact]
    public void EveryDeliveredShipment_HasADeliveryDate()
    {
        // DeliveredLineQuery filters on DeliveryDate != null; a null one drops the whole run
        // out of every volume report.
        Build().Shipments
            .Where(s => s.State == OutgoingShipmentState.Delivered)
            .Should().NotBeEmpty()
            .And.OnlyContain(s => s.DeliveryDate != null);
    }

    [Fact]
    public void EveryShipment_HasADeliveryDateSoTheStateBreakdownSeesIt()
    {
        // GetOperationsEndpoint's window filter is on DeliveryDate for *all* states, so a
        // cancelled run without one never reaches the state donut.
        Build().Shipments.Should().OnlyContain(s => s.DeliveryDate != null);
    }

    [Fact]
    public void DeliveryDates_AreUtcMidday()
    {
        // timestamptz + a day derived in memory: midnight can slide across a day boundary.
        Build().Shipments.Should().OnlyContain(s =>
            s.DeliveryDate!.Value.Kind == DateTimeKind.Utc && s.DeliveryDate.Value.Hour == 12);
    }

    [Fact]
    public void EveryOrder_IsFinishedWithBothDates()
    {
        // The on-time ratio counts only Finished orders carrying both dates.
        Build().Orders.Should().OnlyContain(o =>
            o.State == OrderState.Finished
            && o.RequiredDeliveryDate != null
            && o.ActualDeliveryDate != null);
    }

    [Fact]
    public void NoOrder_IsLeftOpen()
    {
        // History must not add to the open working set the live-state fixtures represent.
        Build().Orders.Should().NotContain(o =>
            o.State == OrderState.New || o.State == OrderState.Planning || o.State == OrderState.Delivering);
    }

    [Fact]
    public void CancelledRuns_CarryNoOrderStops()
    {
        var cancelled = Build().Shipments
            .Where(s => s.State == OutgoingShipmentState.Cancelled)
            .ToList();

        // Cancelling frees orders back to New for reuse rather than cancelling them, so attaching
        // orders here would strand them open and months stale.
        cancelled.Should().NotBeEmpty("the state donut needs a second slice");
        cancelled.Should().OnlyContain(s => s.Stops.Count == 0);
    }

    [Fact]
    public void OnTimeRatio_LandsNearTheTarget()
    {
        var orders = Build().Orders;
        var onTime = orders.Count(o => o.ActualDeliveryDate <= o.RequiredDeliveryDate);
        var pct = onTime * 100m / orders.Count;

        // A flat 100% would read as fake; the generator aims for ~88%.
        pct.Should().BeInRange(80m, 95m);
    }

    [Fact]
    public void EveryOrder_SitsOnExactlyOneStop()
    {
        var bundle = Build();
        var stopOrders = bundle.Shipments
            .SelectMany(s => s.Stops)
            .Select(st => st.ClientOrder)
            .ToList();

        stopOrders.Should().OnlyContain(o => o != null);
        stopOrders.Select(o => o!.PublicId).Should().OnlyHaveUniqueItems();
        stopOrders.Should().HaveCount(bundle.Orders.Count);
    }

    [Fact]
    public void OrderStops_AreKindOrderAndLinkViaTheRealForeignKey()
    {
        var stops = Build().Shipments.SelectMany(s => s.Stops).ToList();

        stops.Should().OnlyContain(st => st.Kind == OutgoingShipmentStopKind.Order);
        // The relationship is keyed on orders.outgoing_shipment_stop_id with Order as the
        // dependent, so assigning ClientOrder is what links the two — EF fills the back-reference
        // and the foreign key on save. The dead client_order_id scalar this used to guard against
        // setting no longer exists.
        stops.Should().OnlyContain(st => st.ClientOrder != null);
    }

    /// <summary>
    /// Every generated run is Delivered, and DeliveredLineQuery reads only the snapshot — so
    /// without these rows the seeded demo database renders every volume report empty.
    /// </summary>
    [Fact]
    public void OrderStops_CarryTheContentSnapshot()
    {
        var stops = Build().Shipments.SelectMany(s => s.Stops).ToList();

        stops.Should().OnlyContain(st => st.Items.Count > 0);
        stops.Should().OnlyContain(st => st.ClientPublicId != null);

        var items = stops.SelectMany(st => st.Items).ToList();
        items.Should().OnlyContain(i => i.ProductName != string.Empty);
        // A blank brewery name means the writer could not resolve product.Brewery, which would
        // silently group every historical line under one empty brewery in the report.
        items.Should().OnlyContain(i => i.BreweryName != string.Empty);
        items.Should().OnlyContain(i => i.BreweryPublicId != Guid.Empty);
        items.Should().OnlyContain(i => i.Quantity > 0);
    }

    [Fact]
    public void AllDates_FallInsideTheRequestedWindow()
    {
        var from = new DateOnly(2026, 3, 1);
        var to = new DateOnly(2026, 4, 30);
        var bundle = Build(from, to);

        bundle.Shipments.Should().OnlyContain(s =>
            DateOnly.FromDateTime(s.DeliveryDate!.Value) >= from
            && DateOnly.FromDateTime(s.DeliveryDate.Value) <= to);
        bundle.Orders.Should().OnlyContain(o =>
            o.ActualDeliveryDate >= from && o.ActualDeliveryDate <= to);
        bundle.Deliveries.Should().OnlyContain(d => d.Date >= from && d.Date <= to);
    }

    [Fact]
    public void DeliveredWeight_IsNonZeroSoVolumeChartsHaveHeight()
    {
        // Weight derives from Kind + PackageSize; a pool of products without a derivable unit
        // weight would render every bar at zero.
        var total = Build().Orders
            .SelectMany(o => o.OrderItems)
            .Sum(oi => ProductWeightCalculator.ComputeLineWeightKg(
                oi.Product!.Kind, oi.Product.PackageSize, oi.Quantity));

        total.Should().BeGreaterThan(0);
    }

    [Fact]
    public void Volume_SpansEveryBreweryAndSeveralKinds()
    {
        var items = Build().Orders.SelectMany(o => o.OrderItems).ToList();

        items.Select(oi => oi.Product!.BreweryId).Distinct().Should().HaveCountGreaterThanOrEqualTo(3);
        items.Select(oi => oi.Product!.Kind).Distinct().Should().HaveCountGreaterThanOrEqualTo(3);
    }

    [Fact]
    public void Returns_ArePresentButNotOnEveryOrder()
    {
        var orders = Build().Orders;
        var withReturns = orders.Count(o => o.Returns.Count > 0);

        withReturns.Should().BeGreaterThan(0);
        withReturns.Should().BeLessThan(orders.Count);
        orders.SelectMany(o => o.Returns).Should().OnlyContain(r => r.Quantity > 0);
    }

    [Fact]
    public void MoreThanOneDriver_IsActiveSoTheDriverChartComparesSomething()
    {
        Build().Shipments
            .Where(s => s.State == OutgoingShipmentState.Delivered)
            .SelectMany(s => s.Drivers)
            .Select(d => d.Driver!.PublicId)
            .Distinct()
            .Should().HaveCountGreaterThan(1);
    }

    [Fact]
    public void SummerOutweighsWinter_PerDeliveredUnit()
    {
        // Per *line*, not per order: order line-counts are random, and averaging whole orders
        // lets that noise swamp the signal — an earlier version of this test passed even with
        // seasonality switched off entirely.
        var byMonth = Build().Orders
            .GroupBy(o => o.ActualDeliveryDate!.Value.Month)
            .ToDictionary(
                g => g.Key,
                g => g.SelectMany(o => o.OrderItems).Average(i => (double)i.Quantity));

        // 1.4x summer against 0.8x winter is a 1.75 ratio. Assert the ratio rather than a bare
        // ordering, which a flat generator satisfies half the time by chance.
        (byMonth[7] / byMonth[1]).Should().BeGreaterThan(1.3);
    }

    [Fact]
    public void IncomingDeliveries_AreFinishedWithItems()
    {
        var deliveries = Build().Deliveries;

        // The incoming-vs-outgoing chart counts Finished deliveries only.
        deliveries.Should().OnlyContain(d => d.State == ProductDeliveryState.Finished);
        deliveries.Should().OnlyContain(d => d.Stops.Count > 0);
        deliveries.SelectMany(d => d.Stops).Should().OnlyContain(s => s.Items.Count > 0);
    }

    [Fact]
    public void CreateHistory_RejectsAnInvertedWindow()
    {
        var act = () => Build(To, From);
        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void CreateHistory_RejectsMissingPrerequisites()
    {
        var breweries = Breweries();
        var act = () => HistoryBuilder.CreateHistory(
            [], breweries.SelectMany(b => b.Products).ToList(), Vehicles(), Drivers(), breweries, From, To);

        act.Should().Throw<ArgumentException>();
    }

    // ---- fixtures ----

    private static List<Client> Clients() =>
        Enumerable.Range(0, 8)
            .Select(i => new Client
            {
                Id = i + 1,
                PublicId = Guid.NewGuid(),
                Name = $"Klient {i + 1}",
                Region = i % 2 == 0 ? Region.ZittauCity : Region.Chemnitz,
            })
            .ToList();

    private static List<Vehicle> Vehicles() =>
    [
        new() { Id = 1, PublicId = Guid.NewGuid(), Name = "Vůz A", MaxWeight = 1200 },
        new() { Id = 2, PublicId = Guid.NewGuid(), Name = "Vůz B", MaxWeight = 3500 },
    ];

    private static List<Driver> Drivers() =>
    [
        new() { Id = 1, PublicId = Guid.NewGuid(), FirstName = "A", LastName = "Řidič", Color = "#F08C00" },
        new() { Id = 2, PublicId = Guid.NewGuid(), FirstName = "B", LastName = "Řidič", Color = "#1A73E8" },
        new() { Id = 3, PublicId = Guid.NewGuid(), FirstName = "C", LastName = "Řidič", Color = "#2E9E5B" },
    ];

    private static List<Brewery> Breweries()
    {
        var kinds = new[] { ProductKind.Keg, ProductKind.Bottle, ProductKind.Can };
        var sizes = new[] { 50d, 0.5d, 0.5d };

        return Enumerable.Range(0, 3)
            .Select(b => new Brewery
            {
                Id = b + 1,
                PublicId = Guid.NewGuid(),
                Name = $"Pivovar {b + 1}",
                Products = Enumerable.Range(0, 9)
                    .Select(p => new Product
                    {
                        Id = b * 100 + p + 1,
                        BreweryId = b + 1,
                        PublicId = Guid.NewGuid(),
                        Name = $"Produkt {b + 1}-{p + 1}",
                        Kind = kinds[p % kinds.Length],
                        Type = ProductType.PaleLager,
                        PackageSize = sizes[p % sizes.Length],
                        PriceWithVat = 100 + p,
                    })
                    .ToList(),
            })
            .ToList();
    }
}
