using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;
using static AleTrack.Tests.Features.OutgoingShipments.OutgoingShipmentTestHelpers;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// A pickup stop travels through the shipment editor's save like the company stop does, so the
/// planner can put it somewhere in the route before it exists.
/// </summary>
/// <remarks>
/// Whether the stop is needed remains the server's call — the reconciler still drops one nothing is
/// collected from and adds one the orders ask for. What the client contributes is only its place in
/// the route, and its label and coordinates are still taken from the supplier rather than the
/// request, so a stale client cannot pin the plnírna somewhere else.
/// </remarks>
public sealed class SupplierStopRoundTripTests
{
    [Fact]
    public async Task ProcessAsync_PlacedMidRoute_KeepsThatPosition()
    {
        var f = Arrange();

        // The planner dropped the pickup between the two deliveries.
        f.Request.Data.CustomStops =
        [
            new CustomStopDto
            {
                Kind = OutgoingShipmentStopKind.Supplier,
                SupplierId = f.Supplier.PublicId,
                Order = 2,
                Label = "ignorováno"
            }
        ];
        f.Request.Data.ClientOrderShipments[0].Order = 1;

        await Act(f);

        var stop = f.Shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Supplier).Subject;
        stop.Order.Should().Be(2);
        // Authored from the supplier, not from the request.
        stop.Label.Should().Be("Linde Gas");
        stop.SupplierId.Should().Be(f.Supplier.Id);
    }

    /// <summary>
    /// An existing stop keeps its row rather than being replaced, which is what a client sending it
    /// back by id is for — the alternative orphans the stored row on every save.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_ExistingStopSentBackById_KeepsTheRow()
    {
        var f = Arrange();

        var stored = new OutgoingShipmentStop
        {
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Supplier,
            Order = 3,
            Supplier = f.Supplier,
            SupplierId = f.Supplier.Id,
            Label = "Linde Gas"
        };
        f.Shipment.Stops.Add(stored);

        f.Request.Data.CustomStops =
        [
            new CustomStopDto
            {
                Id = stored.PublicId,
                Kind = OutgoingShipmentStopKind.Supplier,
                SupplierId = f.Supplier.PublicId,
                Order = 1,
                Label = "ignorováno"
            }
        ];
        f.Request.Data.ClientOrderShipments[0].Order = 2;

        await Act(f);

        f.Shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Supplier)
            .Which.Should().BeSameAs(stored);
        stored.Order.Should().Be(1);
    }

    /// <summary>
    /// The server still owns the decision: a stop for a supplier nothing is collected from goes,
    /// however the client ordered it.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_SentForASupplierNothingIsCollectedFrom_IsDropped()
    {
        var f = Arrange(fromGarage: 2);

        f.Request.Data.CustomStops =
        [
            new CustomStopDto
            {
                Kind = OutgoingShipmentStopKind.Supplier,
                SupplierId = f.Supplier.PublicId,
                Order = 2
            }
        ];

        await Act(f);

        f.Shipment.Stops.Should().NotContain(s => s.Kind == OutgoingShipmentStopKind.Supplier);
    }

    /// <summary>And a needed one the client left out is still added.</summary>
    [Fact]
    public async Task ProcessAsync_NotSentButNeeded_IsAdded()
    {
        var f = Arrange();
        f.Request.Data.CustomStops = [];

        await Act(f);

        f.Shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Supplier)
            .Which.SupplierId.Should().Be(f.Supplier.Id);
    }

    [Fact]
    public async Task ProcessAsync_UnknownSupplier_ReportsNotFound()
    {
        var f = Arrange();
        f.Request.Data.CustomStops =
        [
            new CustomStopDto
            {
                Kind = OutgoingShipmentStopKind.Supplier,
                SupplierId = Guid.NewGuid(),
                Order = 2
            }
        ];

        var act = async () => await Act(f);

        await act.Should().ThrowAsync<AleTrackException>();
    }

    private sealed record Fixture(
        OutgoingShipment Shipment,
        Supplier Supplier,
        UpdateOutgoingShipmentRequest Request,
        Mock<AleTrackDbContext> DbContext);

    private static Fixture Arrange(int fromGarage = 0)
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client);

        var supplier = SupplierBuilder.BuildEntity(
            publicId: Guid.NewGuid(), id: 1, name: "Linde Gas",
            officialAddress: AddressBuilder.BuildEntity(latitude: 50.77m, longitude: 15.05m));

        var good = SupplierBuilder.BuildGood(publicId: Guid.NewGuid(), id: 10, supplierId: supplier.Id);
        good.Supplier = supplier;

        order.SupplierGoodItems =
        [
            new OrderSupplierGoodItem
            {
                PublicId = Guid.NewGuid(), SupplierGood = good, Quantity = 2, QuantityFromGarage = fromGarage
            }
        ];

        var orderStop = new OutgoingShipmentStop
        {
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = 1,
            ClientOrder = order,
            SelectedAddressKind = DeliveryAddressKind.Official
        };

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: Guid.NewGuid(), state: OutgoingShipmentState.Created, stops: [orderStop]);

        var request = new UpdateOutgoingShipmentRequest
        {
            Id = shipment.PublicId,
            Data = OutgoingShipmentBuilder.BuildUpdateDto(
                driverIds: [],
                state: OutgoingShipmentState.Created,
                clientOrderShipments:
                [
                    new ClientOrderShipmentDto
                    {
                        ClientOrderId = order.PublicId,
                        Order = 1,
                        SelectedAddressKind = DeliveryAddressKind.Official
                    }
                ])
        };
        request.Data.Name = shipment.Name;

        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            orders: [order],
            outgoingShipments: [shipment],
            suppliers: [supplier],
            supplierGoods: [good]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        return new Fixture(shipment, supplier, request, db);
    }

    private static async Task Act(Fixture f)
    {
        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>
            .Create(f.DbContext.Object, Options.Create(Company), DriverScopeMockFactory.Unscoped(), AppContextMockFactory.Anonymous());

        await endpoint.HandleAsync(f.Request, CancellationToken.None);
    }
}
