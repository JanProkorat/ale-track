using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;

namespace AleTrack.Features.Seeding;

internal sealed class ProductData
{
    public static List<Product> GetSampleBottledProducts()
    {
        return new List<Product>
        {
            new Product
            {
                BreweryId = 2,
                Name = "Svijanská Desítka",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.Four,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = BottleSize.TenLiters,
                PriceForUnitWithoutVat = 12.23m,
                PriceForUnitWithVat = 14.80m,
                PriceWithVat = 296.00m
            },
            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Máz",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.TenLiters,
                PriceForUnitWithoutVat = 14.05m,
                PriceForUnitWithVat = 17.00m,
                PriceWithVat = 340.00m
            },
            new Product
            {
                BreweryId = 2,
                Name = "Svijany 450",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FourPointSix,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.TenLiters,
                PriceForUnitWithoutVat = 16.12m,
                PriceForUnitWithVat = 19.50m,
                PriceWithVat = 390.00m
            },
            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Rytíř",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = BottleSize.TenLiters,
                PriceForUnitWithoutVat = 14.55m,
                PriceForUnitWithVat = 17.60m,
                PriceWithVat = 352.00m
            },
            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Kníže",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointSix,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = BottleSize.TenLiters,
                PriceForUnitWithoutVat = 16.53m,
                PriceForUnitWithVat = 20.00m,
                PriceWithVat = 400.00m
            },
            new Product
            {
                BreweryId = 2,
                Name = "Svijanská Kněžna",
                Kind = ProductKind.Bottle,
                Type = ProductType.DarkStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointTwo,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = BottleSize.TenLiters,
                PriceForUnitWithoutVat = 16.53m,
                PriceForUnitWithVat = 20.00m,
                PriceWithVat = 400.00m
            },
            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Baron",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.SixPointFive,
                PlatoDegree = PlatoDegree.Fifteen,
                PackageSize = BottleSize.TenLiters,
                PriceForUnitWithoutVat = 16.94m,
                PriceForUnitWithVat = 20.50m,
                PriceWithVat = 410.00m
            },
            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Vozka",
                Kind = ProductKind.Bottle,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = BottleSize.TenLiters,
                PriceForUnitWithoutVat = 12.09m,
                PriceForUnitWithVat = 13.90m,
                PriceWithVat = 278.00m
            }
        };
    }
}