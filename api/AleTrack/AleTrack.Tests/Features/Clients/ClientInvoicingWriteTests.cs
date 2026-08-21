using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.Clients.Commands.Create;
using AleTrack.Features.Clients.Commands.Delete;
using AleTrack.Features.Clients.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Clients;

/// <summary>
/// Writing a client that is billed through another one: no official address of its own, a
/// payer recorded, and a payer that cannot be deleted out from under it.
/// </summary>
public sealed class ClientInvoicingWriteTests
{
    [Fact]
    public async Task Create_WithoutOfficialAddress_SavesNull()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();
        var command = new CreateClientRequest
        {
            Data = ClientBuilder.BuildCreateDto(name: "Pub A", noOfficialAddress: true)
        };

        var endpoint = EndpointBuilder<CreateClientRequest, CreateClientEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.Clients.Add(It.Is<Client>(c =>
            c.Name == "Pub A" && c.OfficialAddress == null && c.InvoicingClientId == null)), Times.Once);
    }

    [Fact]
    public async Task Create_WithInvoicingClient_RecordsItsInternalId()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 42;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer]);

        var command = new CreateClientRequest
        {
            Data = ClientBuilder.BuildCreateDto(
                name: "Pub A", noOfficialAddress: true, invoicingClientId: payer.PublicId)
        };

        var endpoint = EndpointBuilder<CreateClientRequest, CreateClientEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.Clients.Add(It.Is<Client>(c => c.InvoicingClientId == 42)), Times.Once);
    }

    [Fact]
    public async Task Update_ClearingInvoicingClient_SetsItBackToNull()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 42;
        var client = ClientBuilder.BuildEntity(name: "Pub A", invoicingClientId: payer.Id);
        client.Id = 5;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer, client]);

        var command = new UpdateClientRequest
        {
            Id = client.PublicId,
            Data = ClientBuilder.BuildUpdateDto(name: "Pub A", invoicingClientId: null)
        };

        var endpoint = EndpointBuilder<UpdateClientRequest, UpdateClientEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        client.InvoicingClientId.Should().BeNull();
    }

    [Fact]
    public async Task Update_ClearingOfficialAddress_SetsItBackToNull()
    {
        var client = ClientBuilder.BuildEntity(name: "Pub A");
        client.Id = 5;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var command = new UpdateClientRequest
        {
            Id = client.PublicId,
            Data = ClientBuilder.BuildUpdateDto(name: "Pub A", noOfficialAddress: true)
        };

        var endpoint = EndpointBuilder<UpdateClientRequest, UpdateClientEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        client.OfficialAddress.Should().BeNull();
    }

    [Fact]
    public async Task Delete_ClientWithSubClients_Throws400()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 42;
        var sub = ClientBuilder.BuildEntity(name: "Pub A", invoicingClientId: payer.Id);
        sub.Id = 5;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer, sub]);

        var endpoint = EndpointBuilder<DeleteClientRequest, DeleteClientEndpoint>.Create(dbContext.Object);
        var act = () => endpoint.HandleAsync(new DeleteClientRequest { Id = payer.PublicId }, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>()).Which.StatusCode.Should().Be(400);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Delete_ClientWithoutSubClients_Deletes()
    {
        var client = ClientBuilder.BuildEntity(name: "Pub A");
        client.Id = 5;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var endpoint = EndpointBuilder<DeleteClientRequest, DeleteClientEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new DeleteClientRequest { Id = client.PublicId }, CancellationToken.None);

        dbContext.Verify(e => e.Clients.Remove(client), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
