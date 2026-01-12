using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.Delete;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

public sealed class DeleteOutgoingShipmentTests
{
    [Fact]
    public async Task ProcessAsync_DeleteOutgoingShipment_Success()
    {
        var shipmentId = Guid.NewGuid();
        var outgoingShipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Created
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [outgoingShipment]);

        var command = new DeleteOutgoingShipmentRequest
        {
            Id = shipmentId
        };

        var endpoint = EndpointBuilder<DeleteOutgoingShipmentRequest, DeleteOutgoingShipmentEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.OutgoingShipments.Remove(It.IsAny<OutgoingShipment>()), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_DeleteOutgoingShipment_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new DeleteOutgoingShipmentRequest
        {
            Id = Guid.NewGuid()
        };

        var endpoint = EndpointBuilder<DeleteOutgoingShipmentRequest, DeleteOutgoingShipmentEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
