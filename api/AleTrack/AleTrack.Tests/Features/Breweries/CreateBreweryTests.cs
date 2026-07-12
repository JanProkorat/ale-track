using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Breweries.Commands.Create;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using Moq;

namespace AleTrack.Tests.Features.Breweries;

public sealed class CreateBreweryTests
{
    [Fact]
    public async Task ProcessAsync_CreateBrewery_Success()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();
        
        var command = new CreateBreweryRequest
        {
            Data = BreweryBuilder.BuildCreateDto(
                name: "Test Brewery",
                officialAddress: AddressBuilder.BuildDto(
                    city: "city",
                    streetName: "Street",
                    streetNumber: "123",
                    country: Country.Czechia,
                    zip: "12345"
                )
            )
        };

        var endpoint = EndpointBuilder<CreateBreweryRequest, CreateBreweryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);
        
        dbContext.Verify(e => e.Breweries.Add(It.Is<Brewery>(b => 
            b.Name == command.Data.Name &&
            b.Color == command.Data.Color &&
            b.OfficialAddress.StreetName == command.Data.OfficialAddress.StreetName &&
            b.OfficialAddress.StreetNumber == command.Data.OfficialAddress.StreetNumber &&
            b.OfficialAddress.City == command.Data.OfficialAddress.City &&
            b.OfficialAddress.Country == command.Data.OfficialAddress.Country &&
            b.OfficialAddress.Zip == command.Data.OfficialAddress.Zip &&
            ((b.ContactAddress == null && command.Data.ContactAddress == null) ||
             (b.ContactAddress != null && command.Data.ContactAddress != null &&
              b.ContactAddress.StreetName == command.Data.ContactAddress.StreetName &&
              b.ContactAddress.StreetNumber == command.Data.ContactAddress.StreetNumber &&
              b.ContactAddress.City == command.Data.ContactAddress.City &&
              b.ContactAddress.Country == command.Data.ContactAddress.Country &&
              b.ContactAddress.Zip == command.Data.ContactAddress.Zip))
        )), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
