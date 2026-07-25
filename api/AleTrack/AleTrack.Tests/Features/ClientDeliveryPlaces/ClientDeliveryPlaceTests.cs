using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ClientDeliveryPlaces.Commands.Create;
using AleTrack.Features.ClientDeliveryPlaces.Commands.Delete;
using AleTrack.Features.ClientDeliveryPlaces.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.ClientDeliveryPlaces;

public sealed class ClientDeliveryPlaceTests
{
    [Fact]
    public async Task ProcessAsync_CreatePlace_Success()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var command = new CreateClientDeliveryPlaceRequest
        {
            Id = clientId,
            Data = ClientDeliveryPlaceBuilder.BuildSaveDto(name: "Letní zahrádka", note: "Vjezd zezadu")
        };

        var endpoint = EndpointBuilder<CreateClientDeliveryPlaceRequest, CreateClientDeliveryPlaceEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        client.DeliveryPlaces.Should().HaveCount(1);
        client.DeliveryPlaces[0].Name.Should().Be("Letní zahrádka");
        client.DeliveryPlaces[0].Note.Should().Be("Vjezd zezadu");
        client.DeliveryPlaces[0].Address.Latitude.Should().Be(50.897m);
    }

    [Fact]
    public async Task ProcessAsync_CreatePlace_BlankPostalPartsStoredAsNull()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var dto = ClientDeliveryPlaceBuilder.BuildSaveDto();
        dto.Address.StreetName = "";
        dto.Address.StreetNumber = "  ";
        dto.Address.City = "";
        dto.Address.Zip = "";

        var command = new CreateClientDeliveryPlaceRequest { Id = clientId, Data = dto };

        var endpoint = EndpointBuilder<CreateClientDeliveryPlaceRequest, CreateClientDeliveryPlaceEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        var saved = client.DeliveryPlaces[0].Address;
        saved.StreetName.Should().BeNull();
        saved.StreetNumber.Should().BeNull();
        saved.City.Should().BeNull();
        saved.Zip.Should().BeNull();
        saved.Latitude.Should().Be(50.897m);
    }

    [Fact]
    public async Task ProcessAsync_CreatePlace_NullCountryDefaultsToCzechia()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var command = new CreateClientDeliveryPlaceRequest
        {
            Id = clientId,
            Data = ClientDeliveryPlaceBuilder.BuildSaveDto(country: null)
        };

        var endpoint = EndpointBuilder<CreateClientDeliveryPlaceRequest, CreateClientDeliveryPlaceEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        client.DeliveryPlaces[0].Address.Country.Should().Be(Country.Czechia);
    }

    [Fact]
    public async Task ProcessAsync_CreatePlace_ClientNotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new CreateClientDeliveryPlaceRequest
        {
            Id = Guid.NewGuid(),
            Data = ClientDeliveryPlaceBuilder.BuildSaveDto()
        };

        var endpoint = EndpointBuilder<CreateClientDeliveryPlaceRequest, CreateClientDeliveryPlaceEndpoint>
            .Create(dbContext.Object);

        var act = () => endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessAsync_UpdatePlace_Success()
    {
        var placeId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity();
        var place = ClientDeliveryPlaceBuilder.BuildEntity(publicId: placeId, client: client, name: "Původní");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], clientDeliveryPlaces: [place]);

        var command = new UpdateClientDeliveryPlaceRequest
        {
            Id = placeId,
            Data = ClientDeliveryPlaceBuilder.BuildSaveDto(name: "Nový název", latitude: 51.1m, longitude: 15.2m)
        };

        var endpoint = EndpointBuilder<UpdateClientDeliveryPlaceRequest, UpdateClientDeliveryPlaceEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        place.Name.Should().Be("Nový název");
        place.Address.Latitude.Should().Be(51.1m);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_UpdatePlace_SoftDeletedNotFound()
    {
        var placeId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity();
        var place = ClientDeliveryPlaceBuilder.BuildEntity(publicId: placeId, client: client, isDeleted: true);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], clientDeliveryPlaces: [place]);

        var command = new UpdateClientDeliveryPlaceRequest
        {
            Id = placeId,
            Data = ClientDeliveryPlaceBuilder.BuildSaveDto()
        };

        var endpoint = EndpointBuilder<UpdateClientDeliveryPlaceRequest, UpdateClientDeliveryPlaceEndpoint>
            .Create(dbContext.Object);

        var act = () => endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_DeletePlace_SoftDeletesInsteadOfRemoving()
    {
        var placeId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity();
        var place = ClientDeliveryPlaceBuilder.BuildEntity(publicId: placeId, client: client);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], clientDeliveryPlaces: [place]);

        var command = new DeleteClientDeliveryPlaceRequest { Id = placeId };

        var endpoint = EndpointBuilder<DeleteClientDeliveryPlaceRequest, DeleteClientDeliveryPlaceEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        place.IsDeleted.Should().BeTrue();
        dbContext.Verify(e => e.ClientDeliveryPlaces.Remove(It.IsAny<ClientDeliveryPlace>()), Times.Never);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
