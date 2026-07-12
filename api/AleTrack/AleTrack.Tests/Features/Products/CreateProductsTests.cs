using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Features.Products.Commands.Create;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Products;

public sealed class CreateProductsTests
{
    [Fact]
    public async Task ProcessAsync_CreateProducts_Success()
    {
        var breweryId = Guid.NewGuid();
        var brewery = BreweryBuilder.BuildEntity(
            publicId: breweryId,
            officialAddress: AddressBuilder.BuildEntity()
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: [brewery]);
        
        var command = new CreateProductsRequest
        {
            Id = breweryId,
            Data = ProductBuilder.BuildCreateProductsDto(
                products:
                [
                    ProductBuilder.BuildCreateProductDto(),
                    ProductBuilder.BuildCreateProductDto()
                ]
            )
        };

        var endpoint = EndpointBuilder<CreateProductsRequest, CreateProductsEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Verify that products were added to the brewery
        brewery.Products.Should().HaveCount(command.Data.Products.Count);
        
        foreach (var expectedProduct in command.Data.Products)
        {
            brewery.Products.Should().Contain(p => 
                p.Name == expectedProduct.Name &&
                p.Description == expectedProduct.Description &&
                p.Kind == expectedProduct.Kind &&
                p.Type == expectedProduct.Type &&
                Math.Abs(p.AlcoholPercentage!.Value - expectedProduct.AlcoholPercentage!.Value) < 0.001f &&
                Math.Abs(p.PlatoDegree!.Value - expectedProduct.PlatoDegree!.Value) < 0.001f &&
                Math.Abs(p.PackageSize!.Value - expectedProduct.PackageSize!.Value) < 0.001 &&
                p.PriceWithVat == expectedProduct.PriceWithVat &&
                p.PriceForUnitWithVat == expectedProduct.PriceForUnitWithVat &&
                p.PriceForUnitWithoutVat == expectedProduct.PriceForUnitWithoutVat
            );
        }
        
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
    
    [Fact]
    public async Task ProcessAsync_CreateProducts_BreweryNotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new CreateProductsRequest
        {
            Id = Guid.NewGuid(),
            Data = ProductBuilder.BuildCreateProductsDto()
        };

        var endpoint = EndpointBuilder<CreateProductsRequest, CreateProductsEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
