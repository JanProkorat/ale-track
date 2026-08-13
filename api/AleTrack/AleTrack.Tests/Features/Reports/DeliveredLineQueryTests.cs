using AleTrack.Common.Enums;
using AleTrack.Features.Reports.Utils;
using AleTrack.Tests.Builders;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Tests.Features.Reports;

/// <summary>
/// The delivered-line projection reads what the run recorded, not what the product says now.
/// </summary>
public sealed class DeliveredLineQueryTests
{
    /// <summary>
    /// The headline guarantee of the whole snapshot design. Correcting the Svijany seed data on
    /// 2026-07-28 moved nine bottled products from a 10 l package size to 0.5 l and repriced one
    /// of them, and every historical report weight moved with it. That must no longer happen.
    /// </summary>
    [Fact]
    public async Task Project_ReadsTheSnapshot_NotTheLiveProduct()
    {
        var f = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Bottle, ProductType.PaleLager, 0.5, quantity: 20)]);

        var before = await DeliveredLineQuery
            .Project(f.DbContext.Object, new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31), DriverReportScope.Unscoped)
            .ToListAsync();

        var product = f.OrderItems.Single().Product;
        product.PackageSize = 10;
        product.Name = "Přejmenováno";
        product.PriceWithVat = 99m;

        var after = await DeliveredLineQuery
            .Project(f.DbContext.Object, new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31), DriverReportScope.Unscoped)
            .ToListAsync();

        after.Should().BeEquivalentTo(before, "a product edit must not restate delivered history");
        after.Single().PackageSize.Should().Be(0.5);
    }

    [Fact]
    public async Task Project_ReadsClientAttributionFromTheStop_NotTheLiveClient()
    {
        var f = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, 50, quantity: 2)],
            region: Region.ZittauCity);

        f.Client.Name = "Přejmenovaný klient";
        f.Client.Region = Region.Berlin;

        var rows = await DeliveredLineQuery
            .Project(f.DbContext.Object, new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31), DriverReportScope.Unscoped)
            .ToListAsync();

        rows.Single().ClientName.Should().Be("Hospoda U Kotvy");
        rows.Single().ClientRegion.Should().Be(Region.ZittauCity);
    }

    /// <summary>
    /// Colour is presentation, not history: recolouring a brewery repaints old charts too, while
    /// its name is a fact and stays put.
    /// </summary>
    [Fact]
    public async Task Project_ReadsBreweryColourLive_AndBreweryNameFromTheSnapshot()
    {
        var f = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, 50, quantity: 2)]);

        f.Brewery.Color = "#123456";
        f.Brewery.Name = "Přejmenovaný pivovar";

        var row = (await DeliveredLineQuery
            .Project(f.DbContext.Object, new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31), DriverReportScope.Unscoped)
            .ToListAsync()).Single();

        row.BreweryColor.Should().Be("#123456", "colour is presentation and follows the brewery");
        row.BreweryName.Should().Be("Pivovar Zittau", "the name is a fact and follows the snapshot");
    }

    /// <summary>
    /// The formula stays live on purpose, so correcting it moves history — unlike correcting the
    /// data it consumes.
    /// </summary>
    [Fact]
    public async Task Project_DerivesWeightRatherThanStoringIt()
    {
        var f = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, 50, quantity: 2)]);

        var row = (await DeliveredLineQuery
            .Project(f.DbContext.Object, new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31), DriverReportScope.Unscoped)
            .ToListAsync()).Single();

        row.WeightKg.Should().BeGreaterThan(0m);
    }

    [Fact]
    public async Task Project_ExcludesShipmentsThatAreNotDelivered()
    {
        var f = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Cancelled,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, 50, quantity: 2)]);

        var rows = await DeliveredLineQuery
            .Project(f.DbContext.Object, new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31), DriverReportScope.Unscoped)
            .ToListAsync();

        rows.Should().BeEmpty();
    }

    [Fact]
    public async Task Project_ExcludesDeliveriesOutsideTheWindow()
    {
        var f = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 6, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, 50, quantity: 2)]);

        var rows = await DeliveredLineQuery
            .Project(f.DbContext.Object, new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31), DriverReportScope.Unscoped)
            .ToListAsync();

        rows.Should().BeEmpty();
    }
}
