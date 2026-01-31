using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ProductDeliveries.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.ProductDeliveries;

public sealed class UpdateProductDeliveryTests
{
    [Fact]
    public async Task ProcessAsync_UpdateProductDelivery_Success()
    {
        var deliveryId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var driver1Id = Guid.NewGuid();
        var driver2Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);
        var driver2 = DriverBuilder.BuildEntity(publicId: driver2Id);

        var brewery1Id = Guid.NewGuid();
        var brewery1 = BreweryBuilder.BuildEntity(publicId: brewery1Id);

        var product1Id = Guid.NewGuid();
        var product1 = ProductBuilder.BuildEntity(publicId: product1Id);

        var existingStopId = Guid.NewGuid();
        var existingStop = ProductDeliveryBuilder.BuildDeliveryStopEntity(
            publicId: existingStopId,
            brewery: brewery1,
            items:
            [
                ProductDeliveryBuilder.BuildDeliveryItemEntity(
                    product: product1,
                    quantity: 15
                )
            ]
        );

        var productDelivery = ProductDeliveryBuilder.BuildEntity(
            publicId: deliveryId,
            state: ProductDeliveryState.InPlanning,
            stops: [existingStop]
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            productDeliveries: [productDelivery],
            vehicles: [vehicle],
            drivers: [driver1, driver2],
            breweries: [brewery1],
            products: [product1]
        );

        var newDeliveryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5));
        var command = new UpdateProductDeliveryRequest
        {
            Id = deliveryId,
            Data = ProductDeliveryBuilder.BuildUpdateDto(
                deliveryDate: newDeliveryDate,
                state: ProductDeliveryState.OnTheWay,
                vehicleId: vehicleId,
                driverIds: [driver1Id, driver2Id],
                note: "Updated note",
                stops:
                [
                    ProductDeliveryBuilder.BuildUpdateStopDto(
                        publicId: existingStopId,
                        breweryId: brewery1Id,
                        note: "Stop note",
                        products:
                        [
                            ProductDeliveryBuilder.BuildUpdateItemDto(
                                productId: product1Id,
                                quantity: 25,
                                note: "Item note"
                            )
                        ]
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateProductDeliveryRequest, UpdateProductDeliveryEndpoint>.Create(dbContext.Object);
        
        // Manually set up callback to simulate EF Core behavior
        dbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Callback(() =>
            {
                if (productDelivery.Vehicle != null)
                    productDelivery.VehicleId = productDelivery.Vehicle.Id;
            })
            .ReturnsAsync(1);
        
        await endpoint.HandleAsync(command, CancellationToken.None);

        // Verify that the product delivery entity was updated with correct values
        productDelivery.Date.Should().Be(newDeliveryDate);
        productDelivery.State.Should().Be(ProductDeliveryState.OnTheWay);
        productDelivery.Note.Should().Be("Updated note");
        productDelivery.Vehicle.Should().Be(vehicle);
        productDelivery.Drivers.Should().HaveCount(2);
        productDelivery.Stops.Should().HaveCount(1);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_UpdateProductDelivery_AddNewStop()
    {
        var deliveryId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var driver1Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);

        var brewery1Id = Guid.NewGuid();
        var brewery2Id = Guid.NewGuid();
        var brewery1 = BreweryBuilder.BuildEntity(publicId: brewery1Id);
        var brewery2 = BreweryBuilder.BuildEntity(publicId: brewery2Id);

        var product1Id = Guid.NewGuid();
        var product2Id = Guid.NewGuid();
        var product1 = ProductBuilder.BuildEntity(publicId: product1Id);
        var product2 = ProductBuilder.BuildEntity(publicId: product2Id);

        var existingStopId = Guid.NewGuid();
        var existingStop = ProductDeliveryBuilder.BuildDeliveryStopEntity(
            publicId: existingStopId,
            brewery: brewery1,
            items:
            [
                ProductDeliveryBuilder.BuildDeliveryItemEntity(
                    product: product1,
                    quantity: 10
                )
            ]
        );

        var productDelivery = ProductDeliveryBuilder.BuildEntity(
            publicId: deliveryId,
            state: ProductDeliveryState.InPlanning,
            stops: [existingStop]
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            productDeliveries: [productDelivery],
            vehicles: [vehicle],
            drivers: [driver1],
            breweries: [brewery1, brewery2],
            products: [product1, product2]
        );

        var command = new UpdateProductDeliveryRequest
        {
            Id = deliveryId,
            Data = ProductDeliveryBuilder.BuildUpdateDto(
                vehicleId: vehicleId,
                driverIds: [driver1Id],
                stops:
                [
                    // Keep existing stop
                    ProductDeliveryBuilder.BuildUpdateStopDto(
                        publicId: existingStopId,
                        breweryId: brewery1Id,
                        products:
                        [
                            ProductDeliveryBuilder.BuildUpdateItemDto(
                                productId: product1Id,
                                quantity: 10
                            )
                        ]
                    ),
                    // Add new stop
                    ProductDeliveryBuilder.BuildUpdateStopDto(
                        publicId: null,
                        breweryId: brewery2Id,
                        products:
                        [
                            ProductDeliveryBuilder.BuildUpdateItemDto(
                                productId: product2Id,
                                quantity: 20
                            )
                        ]
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateProductDeliveryRequest, UpdateProductDeliveryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        productDelivery.Stops.Should().HaveCount(2);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_UpdateProductDelivery_RemoveStop()
    {
        var deliveryId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var driver1Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);

        var brewery1Id = Guid.NewGuid();
        var brewery2Id = Guid.NewGuid();
        var brewery1 = BreweryBuilder.BuildEntity(publicId: brewery1Id);
        var brewery2 = BreweryBuilder.BuildEntity(publicId: brewery2Id);

        var product1Id = Guid.NewGuid();
        var product2Id = Guid.NewGuid();
        var product1 = ProductBuilder.BuildEntity(publicId: product1Id);
        var product2 = ProductBuilder.BuildEntity(publicId: product2Id);

        var stop1Id = Guid.NewGuid();
        var stop2Id = Guid.NewGuid();
        var stop1 = ProductDeliveryBuilder.BuildDeliveryStopEntity(
            publicId: stop1Id,
            brewery: brewery1,
            items:
            [
                ProductDeliveryBuilder.BuildDeliveryItemEntity(product: product1, quantity: 10)
            ]
        );
        var stop2 = ProductDeliveryBuilder.BuildDeliveryStopEntity(
            publicId: stop2Id,
            brewery: brewery2,
            items:
            [
                ProductDeliveryBuilder.BuildDeliveryItemEntity(product: product2, quantity: 20)
            ]
        );

        var productDelivery = ProductDeliveryBuilder.BuildEntity(
            publicId: deliveryId,
            state: ProductDeliveryState.InPlanning,
            stops: [stop1, stop2]
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            productDeliveries: [productDelivery],
            vehicles: [vehicle],
            drivers: [driver1],
            breweries: [brewery1, brewery2],
            products: [product1, product2]
        );

        var command = new UpdateProductDeliveryRequest
        {
            Id = deliveryId,
            Data = ProductDeliveryBuilder.BuildUpdateDto(
                vehicleId: vehicleId,
                driverIds: [driver1Id],
                stops:
                [
                    // Keep only stop1, remove stop2
                    ProductDeliveryBuilder.BuildUpdateStopDto(
                        publicId: stop1Id,
                        breweryId: brewery1Id,
                        products:
                        [
                            ProductDeliveryBuilder.BuildUpdateItemDto(
                                productId: product1Id,
                                quantity: 10
                            )
                        ]
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateProductDeliveryRequest, UpdateProductDeliveryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        productDelivery.Stops.Should().HaveCount(1);
        productDelivery.Stops.First().PublicId.Should().Be(stop1Id);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_UpdateProductDelivery_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new UpdateProductDeliveryRequest
        {
            Id = Guid.NewGuid(),
            Data = ProductDeliveryBuilder.BuildUpdateDto()
        };

        var endpoint = EndpointBuilder<UpdateProductDeliveryRequest, UpdateProductDeliveryEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_UpdateProductDelivery_VehicleNotFound()
    {
        var deliveryId = Guid.NewGuid();
        var productDelivery = ProductDeliveryBuilder.BuildEntity(
            publicId: deliveryId,
            state: ProductDeliveryState.InPlanning
        );

        var driver1Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);

        var brewery1Id = Guid.NewGuid();
        var brewery1 = BreweryBuilder.BuildEntity(publicId: brewery1Id);

        var product1Id = Guid.NewGuid();
        var product1 = ProductBuilder.BuildEntity(publicId: product1Id);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            productDeliveries: [productDelivery],
            drivers: [driver1],
            breweries: [brewery1],
            products: [product1]
        );

        var command = new UpdateProductDeliveryRequest
        {
            Id = deliveryId,
            Data = ProductDeliveryBuilder.BuildUpdateDto(
                vehicleId: Guid.NewGuid(), // Non-existent vehicle
                driverIds: [driver1Id],
                stops:
                [
                    ProductDeliveryBuilder.BuildUpdateStopDto(
                        breweryId: brewery1Id,
                        products:
                        [
                            ProductDeliveryBuilder.BuildUpdateItemDto(
                                productId: product1Id,
                                quantity: 10
                            )
                        ]
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateProductDeliveryRequest, UpdateProductDeliveryEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_UpdateProductDelivery_DriverNotFound()
    {
        var deliveryId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var productDelivery = ProductDeliveryBuilder.BuildEntity(
            publicId: deliveryId,
            state: ProductDeliveryState.InPlanning
        );

        var brewery1Id = Guid.NewGuid();
        var brewery1 = BreweryBuilder.BuildEntity(publicId: brewery1Id);

        var product1Id = Guid.NewGuid();
        var product1 = ProductBuilder.BuildEntity(publicId: product1Id);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            productDeliveries: [productDelivery],
            vehicles: [vehicle],
            breweries: [brewery1],
            products: [product1]
        );

        var command = new UpdateProductDeliveryRequest
        {
            Id = deliveryId,
            Data = ProductDeliveryBuilder.BuildUpdateDto(
                vehicleId: vehicleId,
                driverIds: [Guid.NewGuid()], // Non-existent driver
                stops:
                [
                    ProductDeliveryBuilder.BuildUpdateStopDto(
                        breweryId: brewery1Id,
                        products:
                        [
                            ProductDeliveryBuilder.BuildUpdateItemDto(
                                productId: product1Id,
                                quantity: 10
                            )
                        ]
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateProductDeliveryRequest, UpdateProductDeliveryEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_UpdateProductDelivery_BreweryNotFound()
    {
        var deliveryId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var driver1Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);

        var productDelivery = ProductDeliveryBuilder.BuildEntity(
            publicId: deliveryId,
            state: ProductDeliveryState.InPlanning
        );

        var product1Id = Guid.NewGuid();
        var product1 = ProductBuilder.BuildEntity(publicId: product1Id);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            productDeliveries: [productDelivery],
            vehicles: [vehicle],
            drivers: [driver1],
            products: [product1]
        );

        var command = new UpdateProductDeliveryRequest
        {
            Id = deliveryId,
            Data = ProductDeliveryBuilder.BuildUpdateDto(
                vehicleId: vehicleId,
                driverIds: [driver1Id],
                stops:
                [
                    ProductDeliveryBuilder.BuildUpdateStopDto(
                        breweryId: Guid.NewGuid(), // Non-existent brewery
                        products:
                        [
                            ProductDeliveryBuilder.BuildUpdateItemDto(
                                productId: product1Id,
                                quantity: 10
                            )
                        ]
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateProductDeliveryRequest, UpdateProductDeliveryEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_UpdateProductDelivery_ProductNotFound()
    {
        var deliveryId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var driver1Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);

        var productDelivery = ProductDeliveryBuilder.BuildEntity(
            publicId: deliveryId,
            state: ProductDeliveryState.InPlanning
        );

        var brewery1Id = Guid.NewGuid();
        var brewery1 = BreweryBuilder.BuildEntity(publicId: brewery1Id);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            productDeliveries: [productDelivery],
            vehicles: [vehicle],
            drivers: [driver1],
            breweries: [brewery1]
        );

        var command = new UpdateProductDeliveryRequest
        {
            Id = deliveryId,
            Data = ProductDeliveryBuilder.BuildUpdateDto(
                vehicleId: vehicleId,
                driverIds: [driver1Id],
                stops:
                [
                    ProductDeliveryBuilder.BuildUpdateStopDto(
                        breweryId: brewery1Id,
                        products:
                        [
                            ProductDeliveryBuilder.BuildUpdateItemDto(
                                productId: Guid.NewGuid(), // Non-existent product
                                quantity: 10
                            )
                        ]
                    )
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateProductDeliveryRequest, UpdateProductDeliveryEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
