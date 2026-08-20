using AleTrack.Common.Enums;
using AleTrack.Features.Products.Commands.Create;
using AleTrack.Features.Products.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// Packaging arrives from the caller and <see cref="ProductKind"/> is derived from it. Previously the
/// caller sent the kind and the unit count was reverse-engineered from the product name, so
/// "Prim. Premium 8x" renamed to anything else silently changed its weight.
/// </summary>
public sealed class ProductPackagingWritePathTests
{
    [Fact]
    public async Task Create_StoresThePackagingPairAndDerivesTheKind()
    {
        var breweryId = Guid.NewGuid();
        var brewery = BreweryBuilder.BuildEntity(
            publicId: breweryId, officialAddress: AddressBuilder.BuildEntity());
        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: [brewery]);

        var command = new CreateProductsRequest
        {
            Id = breweryId,
            Data = ProductBuilder.BuildCreateProductsDto(products:
            [
                ProductBuilder.BuildCreateProductDto(
                    name: "Svijanská Desítka",
                    container: ProductContainer.Bottle,
                    saleUnit: ProductSaleUnit.Crate,
                    unitsPerPackage: 20,
                    packageSize: 0.5)
            ])
        };

        var endpoint = EndpointBuilder<CreateProductsRequest, CreateProductsEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        var created = brewery.Products.Should().ContainSingle().Subject;
        created.Container.Should().Be(ProductContainer.Bottle);
        created.SaleUnit.Should().Be(ProductSaleUnit.Crate);
        created.UnitsPerPackage.Should().Be(20);
        created.Kind.Should().Be(ProductKind.Bottle);
    }

    [Fact]
    public async Task Create_TakesTheUnitCountFromTheCallerNotTheName()
    {
        var breweryId = Guid.NewGuid();
        var brewery = BreweryBuilder.BuildEntity(
            publicId: breweryId, officialAddress: AddressBuilder.BuildEntity());
        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: [brewery]);

        var command = new CreateProductsRequest
        {
            Id = breweryId,
            Data = ProductBuilder.BuildCreateProductsDto(products:
            [
                // A name the old resolver would have read as eight, against an explicit three.
                ProductBuilder.BuildCreateProductDto(
                    name: "Prim. Premium 8x",
                    container: ProductContainer.Bottle,
                    saleUnit: ProductSaleUnit.Multipack,
                    unitsPerPackage: 3,
                    packageSize: 0.5)
            ])
        };

        var endpoint = EndpointBuilder<CreateProductsRequest, CreateProductsEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        brewery.Products.Should().ContainSingle().Subject.UnitsPerPackage.Should().Be(3);
    }

    [Fact]
    public async Task Create_DoesNotFileAJugUnderBasa()
    {
        var breweryId = Guid.NewGuid();
        var brewery = BreweryBuilder.BuildEntity(
            publicId: breweryId, officialAddress: AddressBuilder.BuildEntity());
        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: [brewery]);

        var command = new CreateProductsRequest
        {
            Id = breweryId,
            Data = ProductBuilder.BuildCreateProductsDto(products:
            [
                ProductBuilder.BuildCreateProductDto(
                    name: "Svijanský Kvasničák – 2L",
                    container: ProductContainer.Jug,
                    saleUnit: ProductSaleUnit.Single,
                    unitsPerPackage: 1,
                    packageSize: 2)
            ])
        };

        var endpoint = EndpointBuilder<CreateProductsRequest, CreateProductsEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        var created = brewery.Products.Should().ContainSingle().Subject;
        created.Kind.Should().NotBe(ProductKind.Bottle);
        created.Weight.Should().BeApproximately(2.8, 0.001);
    }

    [Fact]
    public async Task Update_ReplacesThePackagingPairAndRederivesTheKind()
    {
        var product = ProductBuilder.BuildEntity(
            container: ProductContainer.Bottle,
            saleUnit: ProductSaleUnit.Crate,
            unitsPerPackage: 20,
            packageSize: 0.5);
        var brewery = BreweryBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        brewery.Products.Add(product);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            breweries: [brewery], products: [product]);

        var command = new UpdateProductRequest
        {
            Id = product.PublicId,
            Data = ProductBuilder.BuildUpdateProductDto(
                container: ProductContainer.Keg,
                saleUnit: ProductSaleUnit.Single,
                unitsPerPackage: 1,
                packageSize: 50)
        };

        var endpoint = EndpointBuilder<UpdateProductRequest, UpdateProductEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        product.Container.Should().Be(ProductContainer.Keg);
        product.SaleUnit.Should().Be(ProductSaleUnit.Single);
        product.UnitsPerPackage.Should().Be(1);
        product.Kind.Should().Be(ProductKind.Keg);
    }
}
