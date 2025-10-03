using AleTrack.Entities;
using AleTrack.Features.Drivers.Commands.Create;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using Moq;

namespace AleTrack.Tests.Features.Drivers;

public sealed class CreateDriverTests
{
    [Fact]
    public async Task ProcessAsync_CreateDriver_Success()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();
        
        var command = new CreateDriverRequest
        {
            Data = DriverBuilder.BuildCreateDto(
                availableDates:
                [
                    new CreateDriverAvailabilityDto(
                        From: DateTime.Parse("2025-01-01T08:00:00"),
                        Until: DateTime.Parse("2025-01-01T16:00:00")
                    ),
                    new CreateDriverAvailabilityDto(
                        From: DateTime.Parse("2025-01-02T09:00:00"),
                        Until: DateTime.Parse("2025-01-02T17:00:00")
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<CreateDriverRequest, CreateDriverEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);
        
        dbContext.Verify(e => e.Drivers.Add(It.Is<Driver>(d => 
            d.FirstName == command.Data.FirstName &&
            d.LastName == command.Data.LastName &&
            d.PhoneNumber == command.Data.PhoneNumber &&
            d.Color == command.Data.Color &&
            d.Availabilities.Count == command.Data.AvailableDates.Count &&
            d.Availabilities.All(availability => 
                command.Data.AvailableDates.Any(reqAvailability =>
                    availability.From == reqAvailability.From &&
                    availability.Until == reqAvailability.Until))
        )), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
