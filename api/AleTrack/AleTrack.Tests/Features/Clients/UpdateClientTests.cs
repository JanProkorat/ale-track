using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Features.Clients.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Clients;

public sealed class UpdateClientTests
{
    [Fact]
    public async Task ProcessAsync_UpdateClient_Success()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            publicId: clientId,
            name: "Old Name",
            businessName: "Old Business",
            region: Region.ZittauCity,
            officialAddress: AddressBuilder.BuildEntity()
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var command = new UpdateClientRequest
        {
            Id = clientId,
            Data = ClientBuilder.BuildUpdateDto(
                name: "Updated Name",
                businessName: "Updated Business Ltd.",
                region: Region.Berlin,
                officialAddress: AddressBuilder.BuildDto(
                    city: "Brno",
                    streetName: "New Street",
                    streetNumber: "2",
                    country: Country.Czechia,
                    zip: "11111"
                ),
                contacts:
                [
                    new UpdateClientContactDto
                    {
                        Type = ContactType.Email,
                        Description = "Updated contact",
                        Value = "updated@client.com"
                    },

                    new UpdateClientContactDto
                    {
                        Type = ContactType.Phone,
                        Description = "Mobile",
                        Value = "+420987654321"
                    }
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateClientRequest, UpdateClientEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        // Verify that the client entity was updated with correct values
        client.Name.Should().Be(command.Data.Name);
        client.BusinessName.Should().Be(command.Data.BusinessName);
        client.Region.Should().Be(command.Data.Region);
        client.OfficialAddress.City.Should().Be(command.Data.OfficialAddress.City);
        client.OfficialAddress.StreetName.Should().Be(command.Data.OfficialAddress.StreetName);
        client.OfficialAddress.StreetNumber.Should().Be(command.Data.OfficialAddress.StreetNumber);
        client.OfficialAddress.Country.Should().Be(command.Data.OfficialAddress.Country);
        client.OfficialAddress.Zip.Should().Be(command.Data.OfficialAddress.Zip);
        client.Contacts.Count.Should().Be(command.Data.Contacts.Count);
        
        foreach (var expectedContact in command.Data.Contacts)
        {
            client.Contacts.Should().Contain(c => 
                c.Type == expectedContact.Type && 
                c.Description == expectedContact.Description && 
                c.Value == expectedContact.Value);
        }
        
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
    
    [Fact]
    public async Task ProcessAsync_UpdateClient_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new UpdateClientRequest
        {
            Id = Guid.NewGuid(),
            Data = ClientBuilder.BuildUpdateDto()
        };

        var endpoint = EndpointBuilder<UpdateClientRequest, UpdateClientEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
