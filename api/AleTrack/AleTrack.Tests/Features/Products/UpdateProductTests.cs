using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Features.Products.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Products;

public sealed class UpdateProductTests
{
    [Fact]
    public async Task ProcessAsync_UpdateProduct_Success()
    {
        var productId = Guid.NewGuid();
        var product = ProductBuilder.BuildEntity(publicId: productId);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(products: [product]);

        var command = new UpdateProductRequest
        {
            Id = productId,
            Data = ProductBuilder.BuildUpdateProductDto(
                name: "Updated Product Name",
                description: "Updated Description",
                kind: ProductKind.Other,
                type: ProductType.PaleLager,
                alcoholPercentage: 6.0f,
                platoDegree: 14.0f,
                packageSize: 0.7,
                priceWithVat: 70.00m,
                priceForUnitWithVat: 70.00m,
                priceForUnitWithoutVat: 57.85m
            )
        };

        var endpoint = EndpointBuilder<UpdateProductRequest, UpdateProductEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        // Verify that the product entity was updated with correct values
        product.Name.Should().Be(command.Data.Name);
        product.Description.Should().Be(command.Data.Description);
        product.Kind.Should().Be(command.Data.Kind);
        product.Type.Should().Be(command.Data.Type);
        product.AlcoholPercentage.Should().Be(command.Data.AlcoholPercentage);
        product.PlatoDegree.Should().Be(command.Data.PlatoDegree);
        product.PackageSize.Should().Be(command.Data.PackageSize);
        product.PriceWithVat.Should().Be(command.Data.PriceWithVat);
        product.PriceForUnitWithVat.Should().Be(command.Data.PriceForUnitWithVat);
        product.PriceForUnitWithoutVat.Should().Be(command.Data.PriceForUnitWithoutVat);
        
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
    
    [Fact]
    public async Task ProcessAsync_UpdateProduct_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new UpdateProductRequest
        {
            Id = Guid.NewGuid(),
            Data = ProductBuilder.BuildUpdateProductDto()
        };

        var endpoint = EndpointBuilder<UpdateProductRequest, UpdateProductEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
