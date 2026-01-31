using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.ProductDeliveries.Commands.Create;
using AleTrack.Features.ProductDeliveries.Commands.Update;

namespace AleTrack.Tests.Builders;

public static class ProductDeliveryBuilder
{
    public static ProductDelivery BuildEntity(
        Guid? publicId = null,
        DateOnly? date = null,
        ProductDeliveryState? state = null,
        Vehicle? vehicle = null,
        List<Driver>? drivers = null,
        List<DeliveryStop>? stops = null,
        string? note = null)
    {
        return new ProductDelivery
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Date = date ?? DateOnly.FromDateTime(DateTime.UtcNow),
            State = state ?? ProductDeliveryState.InPlanning,
            Vehicle = vehicle,
            Drivers = drivers ?? [],
            Stops = stops ?? [],
            Note = note
        };
    }

    public static CreateProductsDeliveryDto BuildCreateDto(
        DateOnly? deliveryDate = null,
        List<Guid>? driverIds = null,
        Guid? vehicleId = null,
        string? note = null,
        List<CreateProductDeliveryStopDto>? stops = null)
    {
        return new CreateProductsDeliveryDto
        {
            DeliveryDate = deliveryDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            DriverIds = driverIds ?? [],
            VehicleId = vehicleId,
            Note = note,
            Stops = stops ?? []
        };
    }

    public static CreateProductDeliveryStopDto BuildCreateStopDto(
        Guid? breweryId = null,
        string? note = null,
        List<CreateProductDeliveryItemDto>? products = null)
    {
        return new CreateProductDeliveryStopDto
        {
            BreweryId = breweryId ?? Guid.NewGuid(),
            Note = note,
            Products = products ?? []
        };
    }

    public static CreateProductDeliveryItemDto BuildCreateItemDto(
        Guid? productId = null,
        int? quantity = null,
        string? note = null)
    {
        return new CreateProductDeliveryItemDto
        {
            ProductId = productId ?? Guid.NewGuid(),
            Quantity = quantity ?? 10,
            Note = note
        };
    }

    public static UpdateProductDeliveryDto BuildUpdateDto(
        DateOnly? deliveryDate = null,
        ProductDeliveryState? state = null,
        List<Guid>? driverIds = null,
        Guid? vehicleId = null,
        string? note = null,
        List<UpdateProductDeliveryStopDto>? stops = null)
    {
        return new UpdateProductDeliveryDto
        {
            DeliveryDate = deliveryDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            State = state ?? ProductDeliveryState.InPlanning,
            DriverIds = driverIds ?? [],
            VehicleId = vehicleId,
            Note = note,
            Stops = stops ?? []
        };
    }

    public static UpdateProductDeliveryStopDto BuildUpdateStopDto(
        Guid? publicId = null,
        Guid? breweryId = null,
        string? note = null,
        List<UpdateProductDeliveryItemDto>? products = null)
    {
        return new UpdateProductDeliveryStopDto
        {
            PublicId = publicId,
            BreweryId = breweryId ?? Guid.NewGuid(),
            Note = note,
            Products = products ?? []
        };
    }

    public static UpdateProductDeliveryItemDto BuildUpdateItemDto(
        Guid? productId = null,
        int? quantity = null,
        string? note = null)
    {
        return new UpdateProductDeliveryItemDto
        {
            ProductId = productId ?? Guid.NewGuid(),
            Quantity = quantity ?? 10,
            Note = note
        };
    }

    public static DeliveryStop BuildDeliveryStopEntity(
        Guid? publicId = null,
        Brewery? brewery = null,
        List<DeliveryItem>? items = null,
        string? note = null)
    {
        return new DeliveryStop
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Brewery = brewery ?? BreweryBuilder.BuildEntity(),
            Items = items ?? [],
            Note = note
        };
    }

    public static DeliveryItem BuildDeliveryItemEntity(
        Product? product = null,
        int? quantity = null,
        string? note = null)
    {
        return new DeliveryItem
        {
            Product = product ?? ProductBuilder.BuildEntity(),
            Quantity = quantity ?? 10,
            Note = note
        };
    }
}
