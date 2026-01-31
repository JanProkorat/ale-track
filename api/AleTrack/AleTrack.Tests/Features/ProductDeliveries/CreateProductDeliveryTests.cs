using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ProductDeliveries.Commands.Create;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.ProductDeliveries;

public sealed class CreateProductDeliveryTests
{
    [Fact]
    public async Task ProcessAsync_CreateProductDelivery_Success()
    {
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var driver1Id = Guid.NewGuid();
        var driver2Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);
        var driver2 = DriverBuilder.BuildEntity(publicId: driver2Id);

        var brewery1Id = Guid.NewGuid();
        var brewery2Id = Guid.NewGuid();
        var brewery1 = BreweryBuilder.BuildEntity(publicId: brewery1Id);
        var brewery2 = BreweryBuilder.BuildEntity(publicId: brewery2Id);

        var product1Id = Guid.NewGuid();
        var product2Id = Guid.NewGuid();
        var product1 = ProductBuilder.BuildEntity(publicId: product1Id);
        var product2 = ProductBuilder.BuildEntity(publicId: product2Id);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            vehicles: [vehicle],
            drivers: [driver1, driver2],
            breweries: [brewery1, brewery2],
            products: [product1, product2]
        );

        var deliveryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2));
        var command = new CreateProductsDeliveryRequest
        {
            Data = ProductDeliveryBuilder.BuildCreateDto(
                deliveryDate: deliveryDate,
                vehicleId: vehicleId,
                driverIds: [driver1Id, driver2Id],
                note: "Test delivery note",
                stops:
                [
                    ProductDeliveryBuilder.BuildCreateStopDto(
                        breweryId: brewery1Id,
                        note: "Stop 1 note",
                        products:
                        [
                            ProductDeliveryBuilder.BuildCreateItemDto(
                                productId: product1Id,
                                quantity: 20,
                                note: "Item 1 note"
                            )
                        ]
                    ),
                    ProductDeliveryBuilder.BuildCreateStopDto(
                        breweryId: brewery2Id,
                        note: "Stop 2 note",
                        products:
                        [
                            ProductDeliveryBuilder.BuildCreateItemDto(
                                productId: product2Id,
                                quantity: 30,
                                note: "Item 2 note"
                            )
                        ]
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<CreateProductsDeliveryRequest, CreateProductsDeliveryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.ProductDeliveries.Add(It.Is<ProductDelivery>(pd =>
            pd.Date == deliveryDate &&
            pd.State == ProductDeliveryState.InPlanning &&
            pd.Note == "Test delivery note" &&
            pd.Vehicle == vehicle &&
            pd.Drivers.Count == 2 &&
            pd.Stops.Count == 2
        )), Times.Once);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_CreateProductDelivery_WithoutVehicle_Success()
    {
        var driver1Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);

        var brewery1Id = Guid.NewGuid();
        var brewery1 = BreweryBuilder.BuildEntity(publicId: brewery1Id);

        var product1Id = Guid.NewGuid();
        var product1 = ProductBuilder.BuildEntity(publicId: product1Id);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            drivers: [driver1],
            breweries: [brewery1],
            products: [product1]
        );

        var deliveryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2));
        var command = new CreateProductsDeliveryRequest
        {
            Data = ProductDeliveryBuilder.BuildCreateDto(
                deliveryDate: deliveryDate,
                vehicleId: null,
                driverIds: [driver1Id],
                stops:
                [
                    ProductDeliveryBuilder.BuildCreateStopDto(
                        breweryId: brewery1Id,
                        products:
                        [
                            ProductDeliveryBuilder.BuildCreateItemDto(
                                productId: product1Id,
                                quantity: 10
                            )
                        ]
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<CreateProductsDeliveryRequest, CreateProductsDeliveryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.ProductDeliveries.Add(It.Is<ProductDelivery>(pd =>
            pd.Vehicle == null &&
            pd.Drivers.Count == 1 &&
            pd.Stops.Count == 1
        )), Times.Once);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_CreateProductDelivery_VehicleNotFound()
    {
        var driver1Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);

        var brewery1Id = Guid.NewGuid();
        var brewery1 = BreweryBuilder.BuildEntity(publicId: brewery1Id);

        var product1Id = Guid.NewGuid();
        var product1 = ProductBuilder.BuildEntity(publicId: product1Id);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            drivers: [driver1],
            breweries: [brewery1],
            products: [product1]
        );

        var command = new CreateProductsDeliveryRequest
        {
            Data = ProductDeliveryBuilder.BuildCreateDto(
                vehicleId: Guid.NewGuid(), // Non-existent vehicle
                driverIds: [driver1Id],
                stops:
                [
                    ProductDeliveryBuilder.BuildCreateStopDto(
                        breweryId: brewery1Id,
                        products:
                        [
                            ProductDeliveryBuilder.BuildCreateItemDto(
                                productId: product1Id,
                                quantity: 10
                            )
                        ]
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<CreateProductsDeliveryRequest, CreateProductsDeliveryEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_CreateProductDelivery_DriverNotFound()
    {
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var brewery1Id = Guid.NewGuid();
        var brewery1 = BreweryBuilder.BuildEntity(publicId: brewery1Id);

        var product1Id = Guid.NewGuid();
        var product1 = ProductBuilder.BuildEntity(publicId: product1Id);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            vehicles: [vehicle],
            breweries: [brewery1],
            products: [product1]
        );

        var command = new CreateProductsDeliveryRequest
        {
            Data = ProductDeliveryBuilder.BuildCreateDto(
                vehicleId: vehicleId,
                driverIds: [Guid.NewGuid()], // Non-existent driver
                stops:
                [
                    ProductDeliveryBuilder.BuildCreateStopDto(
                        breweryId: brewery1Id,
                        products:
                        [
                            ProductDeliveryBuilder.BuildCreateItemDto(
                                productId: product1Id,
                                quantity: 10
                            )
                        ]
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<CreateProductsDeliveryRequest, CreateProductsDeliveryEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_CreateProductDelivery_BreweryNotFound()
    {
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var driver1Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);

        var product1Id = Guid.NewGuid();
        var product1 = ProductBuilder.BuildEntity(publicId: product1Id);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            vehicles: [vehicle],
            drivers: [driver1],
            products: [product1]
        );

        var command = new CreateProductsDeliveryRequest
        {
            Data = ProductDeliveryBuilder.BuildCreateDto(
                vehicleId: vehicleId,
                driverIds: [driver1Id],
                stops:
                [
                    ProductDeliveryBuilder.BuildCreateStopDto(
                        breweryId: Guid.NewGuid(), // Non-existent brewery
                        products:
                        [
                            ProductDeliveryBuilder.BuildCreateItemDto(
                                productId: product1Id,
                                quantity: 10
                            )
                        ]
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<CreateProductsDeliveryRequest, CreateProductsDeliveryEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_CreateProductDelivery_ProductNotFound()
    {
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var driver1Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);

        var brewery1Id = Guid.NewGuid();
        var brewery1 = BreweryBuilder.BuildEntity(publicId: brewery1Id);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            vehicles: [vehicle],
            drivers: [driver1],
            breweries: [brewery1]
        );

        var command = new CreateProductsDeliveryRequest
        {
            Data = ProductDeliveryBuilder.BuildCreateDto(
                vehicleId: vehicleId,
                driverIds: [driver1Id],
                stops:
                [
                    ProductDeliveryBuilder.BuildCreateStopDto(
                        breweryId: brewery1Id,
                        products:
                        [
                            ProductDeliveryBuilder.BuildCreateItemDto(
                                productId: Guid.NewGuid(), // Non-existent product
                                quantity: 10
                            )
                        ]
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<CreateProductsDeliveryRequest, CreateProductsDeliveryEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
