using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;
using AleTrack.Features.Reports.Queries.DeliveryVolume;
using AleTrack.Features.Reports.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Reports;

public sealed class ProductWeightCalculatorTests
{
    [Theory]
    [InlineData(ProductKind.Keg, KegSize.FiftyLiters, PackageWeight.SixtyTwoKilos)]
    [InlineData(ProductKind.Keg, KegSize.ThirtyLiters, PackageWeight.FortyTwoKilos)]
    [InlineData(ProductKind.Bottle, BottleSize.OneLiter, PackageWeight.OneKilo)]
    [InlineData(ProductKind.Can, CanSize.ZeroPointFiveLiters, PackageWeight.ZeroPointFive)]
    public void Compute_ReturnsWeight_ForKnownKindAndSize(ProductKind kind, double size, double expected)
    {
        ProductWeightCalculator.Compute(kind, size).Should().Be(expected);
    }

    [Fact]
    public void Compute_ReturnsNull_WhenPackageSizeMissing()
    {
        ProductWeightCalculator.Compute(ProductKind.Keg, null).Should().BeNull();
    }

    [Fact]
    public void Compute_ReturnsNull_ForUnknownCombination()
    {
        ProductWeightCalculator.Compute(ProductKind.Multipack, 6).Should().BeNull();
    }

    [Fact]
    public void ProductWeight_DelegatesToCalculator()
    {
        var product = new Product { Kind = ProductKind.Keg, PackageSize = KegSize.FiftyLiters };
        product.Weight.Should().Be(ProductWeightCalculator.Compute(ProductKind.Keg, KegSize.FiftyLiters));
    }
}

public sealed class ReportBucketingTests
{
    [Fact]
    public void BucketStart_Week_SnapsToMonday()
    {
        // 2026-07-25 is a Saturday; its ISO week starts Monday 2026-07-20.
        ReportBucketing.BucketStart(new DateOnly(2026, 7, 25), ReportGranularity.Week)
            .Should().Be(new DateOnly(2026, 7, 20));
        ReportBucketing.BucketStart(new DateOnly(2026, 7, 20), ReportGranularity.Week)
            .Should().Be(new DateOnly(2026, 7, 20));
        // Sunday belongs to the week that started the previous Monday.
        ReportBucketing.BucketStart(new DateOnly(2026, 7, 26), ReportGranularity.Week)
            .Should().Be(new DateOnly(2026, 7, 20));
    }

    [Fact]
    public void RollUp_Month_SumsDaysIntoOnePointPerMonth()
    {
        var daily = new[]
        {
            new DailyBucket(new DateOnly(2026, 6, 30), 10m, 1),
            new DailyBucket(new DateOnly(2026, 7, 1), 5m, 2),
            new DailyBucket(new DateOnly(2026, 7, 31), 7m, 3)
        };

        var points = ReportBucketing.RollUp(daily, ReportGranularity.Month);

        points.Should().HaveCount(2);
        points[0].BucketStart.Should().Be(new DateOnly(2026, 6, 1));
        points[0].WeightKg.Should().Be(10m);
        points[1].BucketStart.Should().Be(new DateOnly(2026, 7, 1));
        points[1].WeightKg.Should().Be(12m);
        points[1].Units.Should().Be(5);
    }

    [Fact]
    public void RollUp_ReturnsEmpty_ForNoRows()
    {
        ReportBucketing.RollUp([], ReportGranularity.Week).Should().BeEmpty();
    }
}

public sealed class GetDeliveryVolumeEndpointTests
{
    [Fact]
    public async Task HandleAsync_AggregatesDeliveredLines_ByKindBreweryTypeAndSeries()
    {
        // Arrange — one delivered shipment with two lines from one brewery.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.Delivered,
            lines:
            [
                new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2),
                new(ProductKind.Can, ProductType.Radler, CanSize.ZeroPointFiveLiters, quantity: 10)
            ]);

        var endpoint = EndpointWithResponseBuilder<GetDeliveryVolumeRequest,
            DeliveryVolumeReportDto, GetDeliveryVolumeEndpoint>.Create(fixture.DbContext.Object);

        // Act
        await endpoint.HandleAsync(new GetDeliveryVolumeRequest
        {
            From = new DateOnly(2026, 7, 1),
            To = new DateOnly(2026, 7, 31),
            Granularity = ReportGranularity.Week
        }, CancellationToken.None);

        // Assert
        var response = endpoint.Response;
        response.Should().NotBeNull();

        // 2 kegs x 62 kg + 10 cans x 0.5 kg = 129 kg
        response.TotalWeightKg.Should().Be(129m);
        response.TotalUnits.Should().Be(12);
        response.ClientsServed.Should().Be(1);

        response.UnitsByKind.Should().HaveCount(2);
        response.UnitsByKind.Single(k => k.Kind == ProductKind.Keg).WeightKg.Should().Be(124m);
        response.UnitsByKind.Single(k => k.Kind == ProductKind.Can).Units.Should().Be(10);

        response.ByBrewery.Should().HaveCount(1);
        response.ByBrewery[0].WeightKg.Should().Be(129m);
        response.ByBrewery[0].Color.Should().Be(fixture.Brewery.Color);

        response.ByType.Should().HaveCount(2);
        response.ByType.Single(t => t.Type == ProductType.PaleLager).WeightKg.Should().Be(124m);

        // 2026-07-20 is a Monday, so the week bucket starts on it.
        response.Series.Should().HaveCount(1);
        response.Series[0].BucketStart.Should().Be(new DateOnly(2026, 7, 20));
        response.Series[0].WeightKg.Should().Be(129m);
    }

    [Fact]
    public async Task HandleAsync_ExcludesShipmentsThatAreNotDelivered()
    {
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.InTransit,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        var endpoint = EndpointWithResponseBuilder<GetDeliveryVolumeRequest,
            DeliveryVolumeReportDto, GetDeliveryVolumeEndpoint>.Create(fixture.DbContext.Object);

        await endpoint.HandleAsync(new GetDeliveryVolumeRequest
        {
            From = new DateOnly(2026, 7, 1),
            To = new DateOnly(2026, 7, 31),
            Granularity = ReportGranularity.Week
        }, CancellationToken.None);

        endpoint.Response.TotalWeightKg.Should().Be(0m);
        endpoint.Response.TotalUnits.Should().Be(0);
        endpoint.Response.Series.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_ExcludesShipmentsOutsideTheWindow()
    {
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 6, 30),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        var endpoint = EndpointWithResponseBuilder<GetDeliveryVolumeRequest,
            DeliveryVolumeReportDto, GetDeliveryVolumeEndpoint>.Create(fixture.DbContext.Object);

        await endpoint.HandleAsync(new GetDeliveryVolumeRequest
        {
            From = new DateOnly(2026, 7, 1),
            To = new DateOnly(2026, 7, 31),
            Granularity = ReportGranularity.Week
        }, CancellationToken.None);

        endpoint.Response.TotalWeightKg.Should().Be(0m);
    }

    [Fact]
    public async Task HandleAsync_CountsProductWithoutDerivableWeight_AsUnitsOnly()
    {
        // Multipack has no weight mapping — it must still count as units, at 0 kg.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Multipack, ProductType.Mix, packageSize: 6, quantity: 4)]);

        var endpoint = EndpointWithResponseBuilder<GetDeliveryVolumeRequest,
            DeliveryVolumeReportDto, GetDeliveryVolumeEndpoint>.Create(fixture.DbContext.Object);

        await endpoint.HandleAsync(new GetDeliveryVolumeRequest
        {
            From = new DateOnly(2026, 7, 1),
            To = new DateOnly(2026, 7, 31),
            Granularity = ReportGranularity.Week
        }, CancellationToken.None);

        endpoint.Response.TotalUnits.Should().Be(4);
        endpoint.Response.TotalWeightKg.Should().Be(0m);
    }

    [Fact]
    public async Task HandleAsync_ReturnsZeroedDto_ForEmptyWindow()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var endpoint = EndpointWithResponseBuilder<GetDeliveryVolumeRequest,
            DeliveryVolumeReportDto, GetDeliveryVolumeEndpoint>.Create(dbContext.Object);

        await endpoint.HandleAsync(new GetDeliveryVolumeRequest
        {
            From = new DateOnly(2026, 7, 1),
            To = new DateOnly(2026, 7, 31),
            Granularity = ReportGranularity.Month
        }, CancellationToken.None);

        var response = endpoint.Response;
        response.TotalWeightKg.Should().Be(0m);
        response.TotalUnits.Should().Be(0);
        response.ClientsServed.Should().Be(0);
        response.UnitsByKind.Should().BeEmpty();
        response.ByBrewery.Should().BeEmpty();
        response.ByType.Should().BeEmpty();
        response.Series.Should().BeEmpty();
    }
}
