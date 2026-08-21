using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Features.Clients.Queries.List;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Clients;

/// <summary>
/// The client list. It backs every client picker in the app, and two clients are allowed to
/// share a name — so the trading name has to travel with them or a picker cannot tell one
/// from the other.
/// </summary>
public sealed class GetClientListTests
{
    [Fact]
    public async Task HandleAsync_ReturnsTradingNameSoSameNamedClientsCanBeToldApart()
    {
        var gastro = ClientBuilder.BuildEntity(name: "Hospoda Na Rohu", businessName: "Na Rohu gastro s.r.o.");
        var family = ClientBuilder.BuildEntity(name: "Hospoda Na Rohu", businessName: "Jan Vrána");

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [gastro, family]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<ClientListItemDto>, GetClientListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        var result = endpoint.Response;
        result.Should().HaveCount(2);
        result.Select(c => c.BusinessName).Should().BeEquivalentTo(["Na Rohu gastro s.r.o.", "Jan Vrána"]);
    }

    [Fact]
    public async Task HandleAsync_LeavesTradingNameNullWhenTheClientHasNone()
    {
        // Optional on the entity, so the picker has to cope with its absence rather than
        // being handed an empty string that reads as a real second line.
        var client = ClientBuilder.BuildEntity(name: "Pivnice U Kapra", region: Region.ZittauCity);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<ClientListItemDto>, GetClientListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        endpoint.Response.Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new
            {
                Name = "Pivnice U Kapra",
                BusinessName = (string?)null,
                Region = Region.ZittauCity
            });
    }
}
