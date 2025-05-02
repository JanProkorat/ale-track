using AleTrack.Common.Models;
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
            Data = new CreateBreweryDto
            {
                Name = "Test Brewery",
                Address = new AddressDto
                {
                    City = "city",
                    StreetName = "Street",
                    StreetNumber = "123",
                    Country = "cz",
                    Zip = "12345"
                }
            }
        };

        var endpoint = EndpointBuilder<CreateBreweryRequest, CreateBreweryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);
        
        dbContext.Verify(e => e.Breweries.Add(It.IsAny<Brewery>()), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
