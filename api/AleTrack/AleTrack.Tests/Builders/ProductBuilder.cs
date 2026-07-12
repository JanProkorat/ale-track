using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Commands.Create;
using AleTrack.Features.Products.Commands.Update;

namespace AleTrack.Tests.Builders;

public static class ProductBuilder
{
    public static Product BuildEntity(
        Guid? publicId = null,
        string? name = null,
        string? description = null,
        ProductKind? kind = null,
        ProductType? type = null,
        float? alcoholPercentage = null,
        float? platoDegree = null,
        double? packageSize = null,
        decimal? priceWithVat = null,
        decimal? priceForUnitWithVat = null,
        decimal? priceForUnitWithoutVat = null)
    {
        return new Product
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Name = name ?? "Test Product",
            Description = description ?? "Test Description",
            Kind = kind ?? ProductKind.Bottle,
            Type = type ?? ProductType.AmberLager,
            AlcoholPercentage = alcoholPercentage ?? 4.5f,
            PlatoDegree = platoDegree ?? 10.0f,
            PackageSize = packageSize ?? 0.5,
            PriceWithVat = priceWithVat ?? 50.00m,
            PriceForUnitWithVat = priceForUnitWithVat ?? 50.00m,
            PriceForUnitWithoutVat = priceForUnitWithoutVat ?? 41.32m
        };
    }

    public static CreateProductDto BuildCreateProductDto(
        string? name = null,
        string? description = null,
        ProductKind? kind = null,
        ProductType? type = null,
        float? alcoholPercentage = null,
        float? platoDegree = null,
        double? packageSize = null,
        decimal? priceWithVat = null,
        decimal? priceForUnitWithVat = null,
        decimal? priceForUnitWithoutVat = null)
    {
        return new CreateProductDto
        {
            Name = name ?? "Test Product",
            Description = description ?? "Test Description",
            Kind = kind ?? ProductKind.Can,
            Type = type ?? ProductType.DarkStrong,
            AlcoholPercentage = alcoholPercentage ?? 4.5f,
            PlatoDegree = platoDegree ?? 10.0f,
            PackageSize = packageSize ?? 0.5,
            PriceWithVat = priceWithVat ?? 50.00m,
            PriceForUnitWithVat = priceForUnitWithVat ?? 50.00m,
            PriceForUnitWithoutVat = priceForUnitWithoutVat ?? 41.32m
        };
    }

    public static CreateProductsDto BuildCreateProductsDto(
        List<CreateProductDto>? products = null)
    {
        return new CreateProductsDto
        {
            Products = products ?? [BuildCreateProductDto()]
        };
    }

    public static UpdateProductDto BuildUpdateProductDto(
        string? name = null,
        string? description = null,
        ProductKind? kind = null,
        ProductType? type = null,
        float? alcoholPercentage = null,
        float? platoDegree = null,
        double? packageSize = null,
        decimal? priceWithVat = null,
        decimal? priceForUnitWithVat = null,
        decimal? priceForUnitWithoutVat = null)
    {
        return new UpdateProductDto
        {
            Name = name ?? "Updated Product",
            Description = description ?? "Updated Description",
            Kind = kind ?? ProductKind.Keg,
            Type = type ?? ProductType.DarkStrong,
            AlcoholPercentage = alcoholPercentage ?? 5.0f,
            PlatoDegree = platoDegree ?? 12.0f,
            PackageSize = packageSize ?? 0.7,
            PriceWithVat = priceWithVat ?? 60.00m,
            PriceForUnitWithVat = priceForUnitWithVat ?? 60.00m,
            PriceForUnitWithoutVat = priceForUnitWithoutVat ?? 49.59m
        };
    }
}
