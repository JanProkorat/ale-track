using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ProductDeliveries.Commands.Delete;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.ProductDeliveries;

public sealed class DeleteProductDeliveryTests
{
    [Fact]
    public async Task ProcessAsync_DeleteProductDelivery_Success()
    {
        var deliveryId = Guid.NewGuid();
        var productDelivery = ProductDeliveryBuilder.BuildEntity(
            publicId: deliveryId,
            state: ProductDeliveryState.InPlanning
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(productDeliveries: [productDelivery]);

        var command = new DeleteProductDeliveryRequest
        {
            Id = deliveryId
        };

        var endpoint = EndpointBuilder<DeleteProductDeliveryRequest, DeleteProductDeliveryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.Remove(It.IsAny<ProductDelivery>()), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_DeleteProductDelivery_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new DeleteProductDeliveryRequest
        {
            Id = Guid.NewGuid()
        };

        var endpoint = EndpointBuilder<DeleteProductDeliveryRequest, DeleteProductDeliveryEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
