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
    
    /// <summary>
    /// Deleting an already-retired product is a 404: the flag is the delete, so a second
    /// one has nothing to act on.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_DeleteAlreadyRetiredProduct_NotFound()
    {
        var productId = Guid.NewGuid();
        var product = ProductBuilder.BuildEntity(publicId: productId);
        product.IsDeleted = true;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(products: [product]);

        var endpoint = EndpointBuilder<DeleteProductRequest, DeleteProductEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(new DeleteProductRequest { Id = productId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
        dbContext.Verify(e => e.Products.Remove(It.IsAny<Product>()), Times.Never);
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
