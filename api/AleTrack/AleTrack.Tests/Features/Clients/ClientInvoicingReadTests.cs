using AleTrack.Common.Models;
using AleTrack.Features.Clients.Queries.Detail;
using AleTrack.Features.Clients.Queries.List;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Clients;

/// <summary>
/// What the two read models say about the payer relation — the detail from both ends, the
/// list from the sub-client's.
/// </summary>
public sealed class ClientInvoicingReadTests
{
    [Fact]
    public async Task Detail_SubClient_NamesItsPayerAndHasNoOfficialAddress()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 42;
        var sub = ClientBuilder.BuildEntity(
            name: "Pub A", noOfficialAddress: true, invoicingClientId: payer.Id, invoicingClient: payer);
        sub.Id = 5;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer, sub]);

        var endpoint = EndpointWithResponseBuilder<GetClientDetailRequest, ClientDto, GetClientDetailEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetClientDetailRequest { Id = sub.PublicId }, CancellationToken.None);

        var result = endpoint.Response;
        result.OfficialAddress.Should().BeNull();
        result.InvoicingClientId.Should().Be(payer.PublicId);
        result.InvoicingClientName.Should().Be("Head Office");
        result.InvoicedClients.Should().BeEmpty();
    }

    [Fact]
    public async Task Detail_Payer_ListsItsSubClients()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 42;
        var sub = ClientBuilder.BuildEntity(
            name: "Pub A", noOfficialAddress: true, invoicingClientId: payer.Id, invoicingClient: payer);
        sub.Id = 5;
        payer.InvoicedClients.Add(sub);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer, sub]);

        var endpoint = EndpointWithResponseBuilder<GetClientDetailRequest, ClientDto, GetClientDetailEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetClientDetailRequest { Id = payer.PublicId }, CancellationToken.None);

        var result = endpoint.Response;
        result.InvoicingClientId.Should().BeNull();
        result.InvoicedClients.Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new { Id = sub.PublicId, Name = "Pub A" });
    }

    [Fact]
    public async Task List_SubClient_CarriesItsPayerName()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 42;
        var sub = ClientBuilder.BuildEntity(
            name: "Pub A", noOfficialAddress: true, invoicingClientId: payer.Id, invoicingClient: payer);
        sub.Id = 5;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer, sub]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<ClientListItemDto>, GetClientListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        var row = endpoint.Response.Single(c => c.Id == sub.PublicId);
        row.InvoicingClientId.Should().Be(payer.PublicId);
        row.InvoicingClientName.Should().Be("Head Office");
    }
}
