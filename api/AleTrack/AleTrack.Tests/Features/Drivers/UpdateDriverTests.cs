using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Drivers.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Drivers;

public sealed class UpdateDriverTests
{
    [Fact]
    public async Task ProcessAsync_UpdateDriver_Success()
    {
        var driverId = Guid.NewGuid();
        var driver = DriverBuilder.BuildEntity(
            publicId: driverId,
            availabilities:
            [
                new DriverAvailability
                {
                    From = DateTime.Parse("2025-01-01T08:00:00"),
                    Until = DateTime.Parse("2025-01-01T16:00:00")
                }
            ]
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(drivers: [driver]);

        var command = new UpdateDriverRequest
        {
            Id = driverId,
            Data = DriverBuilder.BuildUpdateDto(
                firstName: "Updated",
                lastName: "Driver",
                phoneNumber: "+420987654321",
                color: "#33FF57",
                availableDates:
                [
                    new UpdateDriverAvailabilityDto(
                        From: DateTime.Parse("2025-01-02T09:00:00"),
                        Until: DateTime.Parse("2025-01-02T17:00:00")
                    ),
                    new UpdateDriverAvailabilityDto(
                        From: DateTime.Parse("2025-01-03T10:00:00"),
                        Until: DateTime.Parse("2025-01-03T18:00:00")
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateDriverRequest, UpdateDriverEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        // Verify that the driver entity was updated with correct values
        driver.FirstName.Should().Be(command.Data.FirstName);
        driver.LastName.Should().Be(command.Data.LastName);
        driver.PhoneNumber.Should().Be(command.Data.PhoneNumber);
        driver.Color.Should().Be(command.Data.Color);
        driver.Availabilities.Count.Should().Be(command.Data.AvailableDates.Count);
        
        foreach (var expectedAvailability in command.Data.AvailableDates)
        {
            driver.Availabilities.Should().Contain(a => 
                a.From == expectedAvailability.From.ToUniversalTime() && 
                a.Until == expectedAvailability.Until.ToUniversalTime());
        }
        
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
    
    [Fact]
    public async Task ProcessAsync_UpdateDriver_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new UpdateDriverRequest
        {
            Id = Guid.NewGuid(),
            Data = DriverBuilder.BuildUpdateDto()
        };

        var endpoint = EndpointBuilder<UpdateDriverRequest, UpdateDriverEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
