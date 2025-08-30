using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;

namespace AleTrack.Features.Seeding;

/// <summary>
/// Class containing data for seeding products
/// </summary>
internal sealed class ProductData
{
    public static List<Product> GetSampleBottledProducts()
    {
        return
        [
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
        ];
    }

    public static List<Product> GetSampleKegProducts()
    {
        return
        [
            new Product
            {
                BreweryId = 2,
                Name = "Shine",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.TwoPointNine,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 15.21m,
                PriceForUnitWithVat = 18.40m,
                PriceWithVat = 1100.00m,
                PriceWithoutVat = 912.60m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanská Desítka",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.Four,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 14.71m,
                PriceForUnitWithVat = 17.80m,
                PriceWithVat = 1780.00m,
                PriceWithoutVat = 1471.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanská Desítka",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.Four,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 14.71m,
                PriceForUnitWithVat = 17.80m,
                PriceWithVat = 1068.00m,
                PriceWithoutVat = 882.60m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanská Desítka",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.Four,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 15.54m,
                PriceForUnitWithVat = 18.80m,
                PriceWithVat = 564.00m,
                PriceWithoutVat = 466.20m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Šlik",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointFour,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 17.93m,
                PriceForUnitWithVat = 21.70m,
                PriceWithVat = 2170.00m,
                PriceWithoutVat = 1793.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Šlik",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointFour,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 17.93m,
                PriceForUnitWithVat = 21.70m,
                PriceWithVat = 1302.00m,
                PriceWithoutVat = 1075.80m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Šlik",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointFour,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 18.76m,
                PriceForUnitWithVat = 22.70m,
                PriceWithVat = 681.00m,
                PriceWithoutVat = 562.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Máz",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 17.02m,
                PriceForUnitWithVat = 20.60m,
                PriceWithoutVat = 1702.00m,
                PriceWithVat = 2060.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Máz",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 17.02m,
                PriceForUnitWithVat = 20.60m,
                PriceWithoutVat = 1021.20m,
                PriceWithVat = 1236.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Máz",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 17.85m,
                PriceForUnitWithVat = 21.60m,
                PriceWithoutVat = 535.50m,
                PriceWithVat = 648.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Zámek",
                Kind = ProductKind.Keg,
                Type = ProductType.YeastLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 17.85m,
                PriceForUnitWithVat = 21.60m,
                PriceWithoutVat = 1785.00m,
                PriceWithVat = 2160.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Zámek",
                Kind = ProductKind.Keg,
                Type = ProductType.YeastLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 17.85m,
                PriceForUnitWithVat = 21.60m,
                PriceWithoutVat = 1071.00m,
                PriceWithVat = 1296.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Zámek",
                Kind = ProductKind.Keg,
                Type = ProductType.YeastLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 18.68m,
                PriceForUnitWithVat = 22.60m,
                PriceWithoutVat = 560.40m,
                PriceWithVat = 678.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Rytíř",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 17.52m,
                PriceForUnitWithVat = 21.20m,
                PriceWithoutVat = 1752.00m,
                PriceWithVat = 2120.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Rytíř",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 17.52m,
                PriceForUnitWithVat = 21.20m,
                PriceWithoutVat = 1051.20m,
                PriceWithVat = 1272.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Rytíř",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 18.35m,
                PriceForUnitWithVat = 22.20m,
                PriceWithoutVat = 550.50m,
                PriceWithVat = 666.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijany 450",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FourPointSix,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 18.84m,
                PriceForUnitWithVat = 22.80m,
                PriceWithoutVat = 1884.00m,
                PriceWithVat = 2280.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijany 450",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FourPointSix,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 18.84m,
                PriceForUnitWithVat = 22.80m,
                PriceWithoutVat = 1130.40m,
                PriceWithVat = 1368.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijany 450",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FourPointSix,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 19.67m,
                PriceForUnitWithVat = 23.80m,
                PriceWithoutVat = 590.10m,
                PriceWithVat = 714.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Kvasničák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.Six,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 19.01m,
                PriceForUnitWithVat = 23.00m,
                PriceWithoutVat = 1901.00m,
                PriceWithVat = 2300.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Kvasničák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.Six,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 19.01m,
                PriceForUnitWithVat = 23.00m,
                PriceWithoutVat = 1140.60m,
                PriceWithVat = 1380.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Kvasničák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.Six,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 19.83m,
                PriceForUnitWithVat = 24.00m,
                PriceWithoutVat = 594.90m,
                PriceWithVat = 720.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Kníže",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointSix,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 19.01m,
                PriceForUnitWithVat = 23.00m,
                PriceWithoutVat = 1901.00m,
                PriceWithVat = 2300.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Kníže",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointSix,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 19.01m,
                PriceForUnitWithVat = 23.00m,
                PriceWithoutVat = 1140.60m,
                PriceWithVat = 1380.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Kníže",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointSix,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 19.83m,
                PriceForUnitWithVat = 24.00m,
                PriceWithoutVat = 594.90m,
                PriceWithVat = 720.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanská Kněžna",
                Kind = ProductKind.Keg,
                Type = ProductType.DarkStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointTwo,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 19.01m,
                PriceForUnitWithVat = 23.00m,
                PriceWithoutVat = 1140.60m,
                PriceWithVat = 1380.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanská Kněžna",
                Kind = ProductKind.Keg,
                Type = ProductType.DarkStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointTwo,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 19.83m,
                PriceForUnitWithVat = 24.00m,
                PriceWithoutVat = 594.90m,
                PriceWithVat = 720.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Fanda",
                Kind = ProductKind.Keg,
                Type = ProductType.UnfilteredBlendedLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 17.03m,
                PriceForUnitWithVat = 20.60m,
                PriceWithoutVat = 1021.80m,
                PriceWithVat = 1236.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Fanda",
                Kind = ProductKind.Keg,
                Type = ProductType.UnfilteredBlendedLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 17.86m,
                PriceForUnitWithVat = 21.60m,
                PriceWithoutVat = 535.80m,
                PriceWithVat = 648.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Baron",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.SixPointFive,
                PlatoDegree = PlatoDegree.Fifteen,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 20.50m,
                PriceForUnitWithVat = 24.80m,
                PriceWithoutVat = 1230.00m,
                PriceWithVat = 1488.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Baron",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.SixPointFive,
                PlatoDegree = PlatoDegree.Fifteen,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 21.32m,
                PriceForUnitWithVat = 25.80m,
                PriceWithoutVat = 639.60m,
                PriceWithVat = 774.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Dux",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointFive,
                PackageSize = KegSize.ThirtyLiters,
                PlatoDegree = PlatoDegree.Thirteen,
                PriceForUnitWithoutVat = 20.17m,
                PriceForUnitWithVat = 24.40m,
                PriceWithoutVat = 1210.20m,
                PriceWithVat = 1464.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svátek",
                Kind = ProductKind.Keg,
                Type = ProductType.FestiveLager,
                AlcoholPercentage = AlcoholPercentage.Five,
                PackageSize = KegSize.ThirtyLiters,
                PlatoDegree = PlatoDegree.Thirteen,
                PriceForUnitWithoutVat = 20.17m,
                PriceForUnitWithVat = 24.40m,
                PriceWithoutVat = 1210.20m,
                PriceWithVat = 1464.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijany 20 - výroční pivo",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.NinePointFive,
                PlatoDegree = PlatoDegree.Twenty,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 36.12m,
                PriceForUnitWithVat = 43.70m,
                PriceWithoutVat = 1083.60m,
                PriceWithVat = 1311.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Weizenbier",
                Kind = ProductKind.Keg,
                Type = ProductType.WheatBeer,
                AlcoholPercentage = AlcoholPercentage.Five,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 21.90m,
                PriceForUnitWithVat = 26.50m,
                PriceWithoutVat = 1314.00m,
                PriceWithVat = 1580.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Weizenbier",
                Kind = ProductKind.Keg,
                Type = ProductType.WheatBeer,
                AlcoholPercentage = AlcoholPercentage.Five,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 22.73m,
                PriceForUnitWithVat = 27.50m,
                PriceWithoutVat = 681.90m,
                PriceWithVat = 825.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Vozka",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 15.04m,
                PriceForUnitWithVat = 18.20m,
                PriceWithoutVat = 902.40m,
                PriceWithVat = 1092.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Vozka",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 15.78m,
                PriceForUnitWithVat = 19.20m,
                PriceWithoutVat = 476.10m,
                PriceWithVat = 576.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Vozka Yuzu & Bergamot",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 17.02m,
                PriceForUnitWithVat = 20.60m,
                PriceWithVat = 618.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Vozka Yuzu & Bergamot",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 20.25m,
                PriceForUnitWithVat = 24.50m,
                PriceWithoutVat = 1215.00m,
                PriceWithVat = 1470.00m
            },

            new Product
            {
                BreweryId = 2,
                Name = "Svijanský Vozka (bez příchuti)",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = KegSize.FifTeenLiters,
                PriceForUnitWithoutVat = 21.07m,
                PriceForUnitWithVat = 25.50m,
                PriceWithoutVat = 632.10m,
                PriceWithVat = 765.00m
            }
        ];
    }
}