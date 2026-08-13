using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Orders.Queries.Detail;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Orders;

/// <summary>
/// The order detail resolves the run carrying it through its shipment stop, so the
/// screen can link back to the vývoz it was planned onto.
/// </summary>
public sealed class OrderShipmentLinkTests
{
    [Fact]
    public async Task ProcessAsync_OrderPlannedOnShipment_ProjectsShipmentLink()
    {
        var orderId = Guid.NewGuid();
        var shipmentId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client, state: OrderState.Delivering);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            name: "Severní trasa",
            deliveryDate: new DateTime(2026, 8, 12, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.InTransit,
            vehicle: VehicleBuilder.BuildEntity(name: "3A2 1234"),
            drivers:
            [
                new OutgoingShipmentDriver { Driver = DriverBuilder.BuildEntity(firstName: "Jan", lastName: "Novák") },
                new OutgoingShipmentDriver { Driver = DriverBuilder.BuildEntity(firstName: "Petr", lastName: "Svoboda") }
            ]);

        LinkOrderToShipment(order, shipment, stopOrder: 3, totalStops: 7);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            orders: [order],
            outgoingShipments: [shipment]);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = orderId }, CancellationToken.None);

        var shipmentLink = endpoint.Response.OutgoingShipment.Should().NotBeNull().And.Subject.As<OrderOutgoingShipmentDto>();
        shipmentLink.Id.Should().Be(shipmentId);
        shipmentLink.Name.Should().Be("Severní trasa");
        shipmentLink.State.Should().Be(OutgoingShipmentState.InTransit);
        shipmentLink.DeliveryDate.Should().Be(new DateTime(2026, 8, 12, 0, 0, 0, DateTimeKind.Utc));
        shipmentLink.StopOrder.Should().Be(3);
        shipmentLink.StopCount.Should().Be(7);
        shipmentLink.VehicleName.Should().Be("3A2 1234");
        shipmentLink.DriverNames.Should().Equal("Jan Novák", "Petr Svoboda");
    }

    [Fact]
    public async Task ProcessAsync_OrderNotPlanned_ProjectsNoShipment()
    {
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], orders: [order]);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = orderId }, CancellationToken.None);

        endpoint.Response.OutgoingShipment.Should().BeNull();
    }

    [Fact]
    public async Task ProcessAsync_ShipmentCancelled_ProjectsNoShipment()
    {
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client);

        // A cancelled run is soft-deleted, and shipments carry no global query filter —
        // the order is back to unplanned and must not link to it.
        var shipment = OutgoingShipmentBuilder.BuildEntity(state: OutgoingShipmentState.Cancelled);
        LinkOrderToShipment(order, shipment, stopOrder: 1, totalStops: 1);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            orders: [order],
            outgoingShipments: [shipment]);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = orderId }, CancellationToken.None);

        endpoint.Response.OutgoingShipment.Should().BeNull();
    }

    /// <summary>
    /// Wires the order onto <paramref name="shipment"/> as the stop at
    /// <paramref name="stopOrder"/>, padding the route out to
    /// <paramref name="totalStops"/> with custom waypoints so the "3 of 7" count
    /// has something to count.
    /// </summary>
    private static void LinkOrderToShipment(Order order, OutgoingShipment shipment, int stopOrder, int totalStops)
    {
        var stop = new OutgoingShipmentStop
        {
            PublicId = Guid.NewGuid(),
            Order = stopOrder,
            Kind = OutgoingShipmentStopKind.Order,
            OutgoingShipment = shipment,
            ClientOrder = order
        };

        shipment.Stops.Add(stop);
        foreach (var i in Enumerable.Range(0, totalStops - 1))
        {
            shipment.Stops.Add(new OutgoingShipmentStop
            {
                PublicId = Guid.NewGuid(),
                Order = i + 1 >= stopOrder ? i + 2 : i + 1,
                Kind = OutgoingShipmentStopKind.Custom,
                OutgoingShipment = shipment
            });
        }

        order.OutgoingShipmentStop = stop;
    }
}
