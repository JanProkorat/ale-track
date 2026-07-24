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
        List<CreateProductDeliveryItemDto>? products = null,
        DeliveryStopKind kind = DeliveryStopKind.Brewery,
        string? label = null,
        decimal? latitude = null,
        decimal? longitude = null)
    {
        return new CreateProductDeliveryStopDto
        {
            Kind = kind,
            BreweryId = kind == DeliveryStopKind.Custom ? null : (breweryId ?? Guid.NewGuid()),
            Label = label,
            Latitude = latitude,
            Longitude = longitude,
            Note = note,
            Products = products ?? []
        };
    }

    public static CreateProductDeliveryStopDto BuildCreateCustomStopDto(
        string? label = null,
        decimal latitude = 50.1m,
        decimal longitude = 14.4m,
        string? note = null)
        => BuildCreateStopDto(kind: DeliveryStopKind.Custom, label: label ?? "Čerpací stanice", latitude: latitude, longitude: longitude, note: note);

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
        List<UpdateProductDeliveryItemDto>? products = null,
        DeliveryStopKind kind = DeliveryStopKind.Brewery,
        string? label = null,
        decimal? latitude = null,
        decimal? longitude = null)
    {
        return new UpdateProductDeliveryStopDto
        {
            PublicId = publicId,
            Kind = kind,
            BreweryId = kind == DeliveryStopKind.Custom ? null : (breweryId ?? Guid.NewGuid()),
            Label = label,
            Latitude = latitude,
            Longitude = longitude,
            Note = note,
            Products = products ?? []
        };
    }

    public static UpdateProductDeliveryStopDto BuildUpdateCustomStopDto(
        Guid? publicId = null,
        string? label = null,
        decimal latitude = 50.1m,
        decimal longitude = 14.4m,
        string? note = null)
        => BuildUpdateStopDto(publicId: publicId, kind: DeliveryStopKind.Custom, label: label ?? "Čerpací stanice", latitude: latitude, longitude: longitude, note: note);

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
        string? note = null,
        int order = 0,
        DeliveryStopKind kind = DeliveryStopKind.Brewery,
        string? label = null,
        decimal? latitude = null,
        decimal? longitude = null)
    {
        return new DeliveryStop
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Order = order,
            Kind = kind,
            Brewery = kind == DeliveryStopKind.Custom ? null : (brewery ?? BreweryBuilder.BuildEntity()),
            Label = label,
            Latitude = latitude,
            Longitude = longitude,
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
