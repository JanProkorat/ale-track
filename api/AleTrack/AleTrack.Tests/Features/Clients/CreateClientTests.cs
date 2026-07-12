using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Clients.Commands.Create;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using Moq;

namespace AleTrack.Tests.Features.Clients;

public sealed class CreateClientTests
{
    [Fact]
    public async Task ProcessAsync_CreateClient_Success()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();
        
        var command = new CreateClientRequest
        {
            Data = ClientBuilder.BuildCreateDto(
                name: "Test Client",
                businessName: "Test Business Ltd.",
                region: Region.ZittauCity,
                officialAddress: AddressBuilder.BuildDto(),
                contacts:
                [
                    new CreateClientContactDto
                    {
                        Type = ContactType.Email,
                        Description = "Main contact",
                        Value = "test@testclient.com"
                    },

                    new CreateClientContactDto
                    {
                        Type = ContactType.Phone,
                        Description = "Office",
                        Value = "+420123456789"
                    }
                ]
            )
        };

        var endpoint = EndpointBuilder<CreateClientRequest, CreateClientEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);
        
        dbContext.Verify(e => e.Clients.Add(It.Is<Client>(c => 
            c.Name == command.Data.Name &&
            c.BusinessName == command.Data.BusinessName &&
            c.Region == command.Data.Region &&
            c.OfficialAddress.StreetName == command.Data.OfficialAddress.StreetName &&
            c.OfficialAddress.StreetNumber == command.Data.OfficialAddress.StreetNumber &&
            c.OfficialAddress.City == command.Data.OfficialAddress.City &&
            c.OfficialAddress.Country == command.Data.OfficialAddress.Country &&
            c.OfficialAddress.Zip == command.Data.OfficialAddress.Zip &&
            c.Contacts.Count == command.Data.Contacts.Count &&
            c.Contacts.All(contact => command.Data.Contacts.Any(reqContact => 
                contact.Type == reqContact.Type && 
                contact.Description == reqContact.Description && 
                contact.Value == reqContact.Value))
        )), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}