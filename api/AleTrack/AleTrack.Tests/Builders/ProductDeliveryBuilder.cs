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
        decimal? longitude = null,
        Guid? supplierId = null)
    {
        return new CreateProductDeliveryStopDto
        {
            Kind = kind,
            // Only the kind's own place is filled. The validators reject a stop carrying another
            // kind's id, so a builder that filled both would make every supplier stop invalid.
            BreweryId = kind == DeliveryStopKind.Brewery ? (breweryId ?? Guid.NewGuid()) : null,
            SupplierId = kind == DeliveryStopKind.Supplier ? (supplierId ?? Guid.NewGuid()) : null,
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

    public static CreateProductDeliveryStopDto BuildCreateSupplierStopDto(
        Guid? supplierId = null,
        string? note = null,
        List<CreateProductDeliveryItemDto>? products = null)
        => BuildCreateStopDto(kind: DeliveryStopKind.Supplier, supplierId: supplierId, note: note, products: products);

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

    public static CreateProductDeliveryItemDto BuildCreateGoodItemDto(
        Guid? supplierGoodId = null,
        SupplierChargeKind chargeKind = SupplierChargeKind.Fill,
        int? quantity = null,
        string? note = null)
    {
        return new CreateProductDeliveryItemDto
        {
            SupplierGoodId = supplierGoodId ?? Guid.NewGuid(),
            ChargeKind = chargeKind,
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
        decimal? longitude = null,
        Guid? supplierId = null)
    {
        return new UpdateProductDeliveryStopDto
        {
            PublicId = publicId,
            Kind = kind,
            // See BuildCreateStopDto — only the kind's own place is filled.
            BreweryId = kind == DeliveryStopKind.Brewery ? (breweryId ?? Guid.NewGuid()) : null,
            SupplierId = kind == DeliveryStopKind.Supplier ? (supplierId ?? Guid.NewGuid()) : null,
            Label = label,
            Latitude = latitude,
            Longitude = longitude,
            Note = note,
            Products = products ?? []
        };
    }

    public static UpdateProductDeliveryStopDto BuildUpdateSupplierStopDto(
        Guid? publicId = null,
        Guid? supplierId = null,
        string? note = null,
        List<UpdateProductDeliveryItemDto>? products = null)
        => BuildUpdateStopDto(publicId: publicId, kind: DeliveryStopKind.Supplier, supplierId: supplierId, note: note, products: products);

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

    public static UpdateProductDeliveryItemDto BuildUpdateGoodItemDto(
        Guid? supplierGoodId = null,
        SupplierChargeKind chargeKind = SupplierChargeKind.Fill,
        int? quantity = null,
        string? note = null)
    {
        return new UpdateProductDeliveryItemDto
        {
            SupplierGoodId = supplierGoodId ?? Guid.NewGuid(),
            ChargeKind = chargeKind,
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
        decimal? longitude = null,
        Supplier? supplier = null)
    {
        return new DeliveryStop
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Order = order,
            Kind = kind,
            Brewery = kind == DeliveryStopKind.Brewery ? (brewery ?? BreweryBuilder.BuildEntity()) : null,
            Supplier = kind == DeliveryStopKind.Supplier ? (supplier ?? SupplierBuilder.BuildEntity()) : null,
            Label = label,
            Latitude = latitude,
            Longitude = longitude,
            Items = items ?? [],
            Note = note
        };
    }

    public static DeliveryStop BuildSupplierStopEntity(
        Guid? publicId = null,
        Supplier? supplier = null,
        List<DeliveryItem>? items = null,
        string? note = null,
        int order = 0)
        => BuildDeliveryStopEntity(publicId: publicId, kind: DeliveryStopKind.Supplier, supplier: supplier, items: items, note: note, order: order);

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

    /// <summary>
    /// A supplier line: a good and the charge kind its price is read from, with no weight inputs —
    /// the shape delivery_items' check constraints require of one.
    /// </summary>
    public static DeliveryItem BuildDeliveryGoodItemEntity(
        SupplierGood? supplierGood = null,
        SupplierChargeKind chargeKind = SupplierChargeKind.Fill,
        int? quantity = null,
        string? note = null)
    {
        return new DeliveryItem
        {
            SupplierGood = supplierGood ?? SupplierBuilder.BuildGood(),
            ChargeKind = chargeKind,
            Quantity = quantity ?? 10,
            Note = note,
            Kind = null,
            PackageSize = null,
            UnitsPerPackage = null
        };
    }
}
