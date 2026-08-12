using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Detail;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The shipment detail only *displays* returns — they are owned by the orders on
/// its route, so they arrive per stop and a custom stop never has any.
/// </summary>
public sealed class GetOutgoingShipmentDetailReturnsTests
{
    [Fact]
    public async Task ProcessAsync_GetDetail_ProjectsReturnsPerOrderStop()
    {
        var shipmentId = Guid.NewGuid();

        var clientA = ClientBuilder.BuildEntity(name: "Hospoda A", officialAddress: AddressBuilder.BuildEntity());
        var clientB = ClientBuilder.BuildEntity(name: "Hospoda B", officialAddress: AddressBuilder.BuildEntity());

        var returnId = Guid.NewGuid();
        var orderA = OrderBuilder.BuildEntity(
            client: clientA,
            returns:
            [
                new OrderReturn { PublicId = returnId, Name = "Sud 50 l", Quantity = 4, Note = "Vadný ventil" },
                new OrderReturn { PublicId = Guid.NewGuid(), Name = "Přepravka", Quantity = 2 }
            ]);

        // Second client on the same route hands nothing back.
        var orderB = OrderBuilder.BuildEntity(client: clientB);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops:
            [
                new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = orderA },
                new OutgoingShipmentStop { Order = 2, Kind = OutgoingShipmentStopKind.Order, ClientOrder = orderB },
                new OutgoingShipmentStop { Order = 3, Kind = OutgoingShipmentStopKind.Custom, Label = "Čerpací stanice" }
            ]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [clientA, clientB],
            orders: [orderA, orderB],
            outgoingShipments: [shipment]);

        var request = new GetOutgoingShipmentDetailRequest { Id = shipmentId };
        var endpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(request, CancellationToken.None);

        var stops = endpoint.Response.Stops.OrderBy(s => s.Order).ToList();
        stops.Should().HaveCount(3);

        stops[0].Returns.Should().HaveCount(2);
        stops[0].Returns.Should().Contain(r => r.Id == returnId && r.Name == "Sud 50 l" && r.Quantity == 4 && r.Note == "Vadný ventil");
        stops[0].Returns.Should().Contain(r => r.Name == "Přepravka" && r.Quantity == 2 && r.Note == null);

        stops[1].Returns.Should().BeEmpty("client B hands nothing back");
        stops[2].Returns.Should().BeEmpty("a custom stop has no order, so it can never carry returns");
    }
}
