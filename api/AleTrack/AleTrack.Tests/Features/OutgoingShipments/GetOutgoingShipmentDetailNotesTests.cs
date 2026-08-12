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
/// Like returns, the shipment detail only *displays* an order's notes — they are
/// owned by the order, arrive per stop, and a custom stop never has any. The
/// Fakturace section reads them from here rather than fetching orders itself.
/// </summary>
public sealed class GetOutgoingShipmentDetailNotesTests
{
    [Fact]
    public async Task ProcessAsync_GetDetail_ProjectsOrderNotesPerStopOldestFirst()
    {
        var shipmentId = Guid.NewGuid();

        var clientA = ClientBuilder.BuildEntity(name: "Hospoda A", officialAddress: AddressBuilder.BuildEntity());
        var clientB = ClientBuilder.BuildEntity(name: "Hospoda B", officialAddress: AddressBuilder.BuildEntity());

        // Deliberately added newest-first, so a projection that forgot to order
        // would hand them back in the wrong sequence.
        var orderA = OrderBuilder.BuildEntity(
            client: clientA,
            notes:
            [
                new OrderNote
                {
                    PublicId = Guid.NewGuid(),
                    Text = "Faktura na jméno provozovny",
                    DateCreated = new DateTime(2026, 7, 20, 9, 0, 0, DateTimeKind.Utc),
                },
                new OrderNote
                {
                    PublicId = Guid.NewGuid(),
                    Text = "Dovézt dopoledne,\nzavolat 30 min předem",
                    DateCreated = new DateTime(2026, 7, 18, 9, 0, 0, DateTimeKind.Utc),
                },
            ]);

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

        stops[0].Notes.Select(n => n.Text).Should().Equal(
            "Dovézt dopoledne,\nzavolat 30 min předem",
            "Faktura na jméno provozovny");

        // The line break is the operator's, and the UI renders it — it must not
        // be normalised away in transit.
        stops[0].Notes[0].Text.Should().Contain("\n");

        stops[1].Notes.Should().BeEmpty("client B's order carries no notes");
        stops[2].Notes.Should().BeEmpty("a custom stop has no order, so it can never carry notes");
    }
}
