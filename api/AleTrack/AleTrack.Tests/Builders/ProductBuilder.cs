using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Commands.Create;
using AleTrack.Features.Products.Commands.Update;
using AleTrack.Features.Products.Utils;

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
        decimal? priceForUnitWithoutVat = null,
        ProductContainer? container = null,
        ProductSaleUnit? saleUnit = null,
        int? unitsPerPackage = null)
    {
        // A caller that still passes only `kind` gets the packaging pair that kind implies, so its
        // weight and grouping stay meaningful without every existing test having to be rewritten.
        var packaging = ResolvePackaging(kind ?? ProductKind.Bottle, container, saleUnit);

        return new Product
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Name = name ?? "Test Product",
            Description = description ?? "Test Description",
            Kind = ProductPackaging.DeriveKind(packaging.Container, packaging.SaleUnit),
            Container = packaging.Container,
            SaleUnit = packaging.SaleUnit,
            UnitsPerPackage = unitsPerPackage ?? DefaultUnits(packaging.SaleUnit, packageSize ?? 0.5),
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
        ProductType? type = null,
        float? alcoholPercentage = null,
        float? platoDegree = null,
        double? packageSize = null,
        decimal? priceWithVat = null,
        decimal? priceForUnitWithVat = null,
        decimal? priceForUnitWithoutVat = null,
        ProductContainer? container = null,
        ProductSaleUnit? saleUnit = null,
        int? unitsPerPackage = null)
    {
        return new CreateProductDto
        {
            Name = name ?? "Test Product",
            Description = description ?? "Test Description",
            Container = container ?? ProductContainer.Can,
            SaleUnit = saleUnit ?? ProductSaleUnit.Single,
            UnitsPerPackage = unitsPerPackage ?? 1,
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
        ProductType? type = null,
        float? alcoholPercentage = null,
        float? platoDegree = null,
        double? packageSize = null,
        decimal? priceWithVat = null,
        decimal? priceForUnitWithVat = null,
        decimal? priceForUnitWithoutVat = null,
        ProductContainer? container = null,
        ProductSaleUnit? saleUnit = null,
        int? unitsPerPackage = null)
    {
        return new UpdateProductDto
        {
            Name = name ?? "Updated Product",
            Description = description ?? "Updated Description",
            Container = container ?? ProductContainer.Keg,
            SaleUnit = saleUnit ?? ProductSaleUnit.Single,
            UnitsPerPackage = unitsPerPackage ?? 1,
            Type = type ?? ProductType.DarkStrong,
            AlcoholPercentage = alcoholPercentage ?? 5.0f,
            PlatoDegree = platoDegree ?? 12.0f,
            PackageSize = packageSize ?? 0.7,
            PriceWithVat = priceWithVat ?? 60.00m,
            PriceForUnitWithVat = priceForUnitWithVat ?? 60.00m,
            PriceForUnitWithoutVat = priceForUnitWithoutVat ?? 49.59m
        };
    }

    /// <summary>
    /// Mirrors the data migration's kind-to-pair mapping, so a test written against the old shape
    /// describes the same product after the change as it did before.
    /// </summary>
    private static (ProductContainer Container, ProductSaleUnit SaleUnit) ResolvePackaging(
        ProductKind kind, ProductContainer? container, ProductSaleUnit? saleUnit)
    {
        var implied = kind switch
        {
            ProductKind.Keg => (ProductContainer.Keg, ProductSaleUnit.Single),
            ProductKind.Bottle => (ProductContainer.Bottle, ProductSaleUnit.Crate),
            ProductKind.Can => (ProductContainer.Can, ProductSaleUnit.Single),
            ProductKind.Multipack => (ProductContainer.Bottle, ProductSaleUnit.Multipack),
            _ => (ProductContainer.Other, ProductSaleUnit.Single),
        };

        return (container ?? implied.Item1, saleUnit ?? implied.Item2);
    }

    private static int DefaultUnits(ProductSaleUnit saleUnit, double packageSize) => saleUnit switch
    {
        ProductSaleUnit.Crate => packageSize <= 0.33 ? 24 : 20,
        ProductSaleUnit.Tray => packageSize <= 0.33 ? 12 : 24,
        _ => 1,
    };
}
