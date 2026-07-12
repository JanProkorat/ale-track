using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Products.Commands.Delete;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Products;

public sealed class DeleteProductTests
{
    [Fact]
    public async Task ProcessAsync_DeleteProduct_Success()
    {
        var productId = Guid.NewGuid();
        var product = ProductBuilder.BuildEntity(publicId: productId);
        
        var dbContext = AleTrackDbContextMockFactory.CreateMock(products: [product]);

        var command = new DeleteProductRequest
        {
            Id = productId
        };

        var endpoint = EndpointBuilder<DeleteProductRequest, DeleteProductEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.Products.Remove(It.IsAny<Product>()), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
    
    [Fact]
    public async Task ProcessAsync_DeleteProduct_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new DeleteProductRequest
        {
            Id = Guid.NewGuid()
        };

        var endpoint = EndpointBuilder<DeleteProductRequest, DeleteProductEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
