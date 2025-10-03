using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Features.Breweries.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Breweries;

public sealed class UpdateBreweryTests
{
    [Fact]
    public async Task ProcessAsync_UpdateBrewery_Success()
    {
        var breweryId = Guid.NewGuid();
        var brewery = BreweryBuilder.BuildEntity(
            publicId: breweryId,
            name: "Old Name",
            color: "#000000",
            officialAddress: AddressBuilder.BuildEntity()
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: [brewery]);

        var command = new UpdateBreweryRequest
        {
            Id = breweryId,
            Data = BreweryBuilder.BuildUpdateDto(
                name: "Updated Name",
                color: "#FFFFFF",
                officialAddress: AddressBuilder.BuildDto(
                    city: "New City",
                    streetName: "New Street",
                    streetNumber: "2",
                    country: Country.Czechia,
                    zip: "11111"
                )
            )
        };

        var endpoint = EndpointBuilder<UpdateBreweryRequest, UpdateBreweryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        // Verify that the brewery entity was updated with correct values
        brewery.Name.Should().Be(command.Data.Name);
        brewery.Color.Should().Be(command.Data.Color);
        brewery.OfficialAddress.City.Should().Be(command.Data.OfficialAddress.City);
        brewery.OfficialAddress.StreetName.Should().Be(command.Data.OfficialAddress.StreetName);
        brewery.OfficialAddress.StreetNumber.Should().Be(command.Data.OfficialAddress.StreetNumber);
        brewery.OfficialAddress.Country.Should().Be(command.Data.OfficialAddress.Country);
        brewery.OfficialAddress.Zip.Should().Be(command.Data.OfficialAddress.Zip);
        
        if (command.Data.ContactAddress != null)
        {
            brewery.ContactAddress.Should().NotBeNull();
            brewery.ContactAddress!.City.Should().Be(command.Data.ContactAddress.City);
            brewery.ContactAddress.StreetName.Should().Be(command.Data.ContactAddress.StreetName);
            brewery.ContactAddress.StreetNumber.Should().Be(command.Data.ContactAddress.StreetNumber);
            brewery.ContactAddress.Country.Should().Be(command.Data.ContactAddress.Country);
            brewery.ContactAddress.Zip.Should().Be(command.Data.ContactAddress.Zip);
        }
        else
        {
            brewery.ContactAddress.Should().BeNull();
        }

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
    
    [Fact]
    public async Task ProcessAsync_UpdateBrewery_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new UpdateBreweryRequest
        {
            Id = Guid.NewGuid(),
            Data = BreweryBuilder.BuildUpdateDto()
        };

        var endpoint = EndpointBuilder<UpdateBreweryRequest, UpdateBreweryEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}