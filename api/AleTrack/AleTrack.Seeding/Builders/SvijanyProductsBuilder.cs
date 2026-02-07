using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;

namespace AleTrack.Seeding.Builders;

/// <summary>
/// Class containing data for seeding products
/// </summary>
internal static class SvijanyProductsBuilder
{
    /// <summary>
    /// Get products of type bottle
    /// </summary>
    /// <returns></returns>
    public static List<Product> GetSampleBottledProducts()
    {
        return
        [
            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Fanda",
                Kind = ProductKind.Bottle,
                Type = ProductType.MixedLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.TenLiters,
                PriceForUnitWithoutVat = 15.70m,
                PriceForUnitWithVat = 19.00m,
                PriceWithVat = 380.00m
            },
            
            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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

    /// <summary>
    /// Retrieves products of type beer keg.
    /// </summary>
    /// <returns></returns>
    public static List<Product> GetSampleKegProducts()
    {
        return
        [
            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Svijanská Desítka",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.Four,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 15.54m,
                PriceForUnitWithVat = 18.80m,
                PriceWithVat = 564.00m,
                PriceWithoutVat = 466.20m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Šlik",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointFour,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 18.76m,
                PriceForUnitWithVat = 22.70m,
                PriceWithVat = 681.00m,
                PriceWithoutVat = 562.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Máz",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 17.85m,
                PriceForUnitWithVat = 21.60m,
                PriceWithoutVat = 535.50m,
                PriceWithVat = 648.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Zámek",
                Kind = ProductKind.Keg,
                Type = ProductType.YeastLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 18.68m,
                PriceForUnitWithVat = 22.60m,
                PriceWithoutVat = 560.40m,
                PriceWithVat = 678.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Rytíř",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 18.35m,
                PriceForUnitWithVat = 22.20m,
                PriceWithoutVat = 550.50m,
                PriceWithVat = 666.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Svijany 450",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FourPointSix,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 19.67m,
                PriceForUnitWithVat = 23.80m,
                PriceWithoutVat = 590.10m,
                PriceWithVat = 714.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Kvasničák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.Six,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 19.83m,
                PriceForUnitWithVat = 24.00m,
                PriceWithoutVat = 594.90m,
                PriceWithVat = 720.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Kníže",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointSix,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 19.83m,
                PriceForUnitWithVat = 24.00m,
                PriceWithoutVat = 594.90m,
                PriceWithVat = 720.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Svijanská Kněžna",
                Kind = ProductKind.Keg,
                Type = ProductType.DarkStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointTwo,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 19.83m,
                PriceForUnitWithVat = 24.00m,
                PriceWithoutVat = 594.90m,
                PriceWithVat = 720.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Fanda",
                Kind = ProductKind.Keg,
                Type = ProductType.UnfilteredBlendedLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 17.86m,
                PriceForUnitWithVat = 21.60m,
                PriceWithoutVat = 535.80m,
                PriceWithVat = 648.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Baron",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.SixPointFive,
                PlatoDegree = PlatoDegree.Fifteen,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 21.32m,
                PriceForUnitWithVat = 25.80m,
                PriceWithoutVat = 639.60m,
                PriceWithVat = 774.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Svijany 20 - výroční pivo",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.NinePointFive,
                PlatoDegree = PlatoDegree.Twenty,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 36.12m,
                PriceForUnitWithVat = 43.70m,
                PriceWithoutVat = 1083.60m,
                PriceWithVat = 1311.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Weizenbier",
                Kind = ProductKind.Keg,
                Type = ProductType.WheatBeer,
                AlcoholPercentage = AlcoholPercentage.Five,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 22.73m,
                PriceForUnitWithVat = 27.50m,
                PriceWithoutVat = 681.90m,
                PriceWithVat = 825.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Vozka",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 15.78m,
                PriceForUnitWithVat = 19.20m,
                PriceWithoutVat = 476.10m,
                PriceWithVat = 576.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
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
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Vozka Yuzu & Bergamot",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 20.25m,
                PriceForUnitWithVat = 24.50m,
                PriceWithoutVat = 1215.00m,
                PriceWithVat = 1470.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Vozka (bez příchuti)",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = KegSize.FifteenLiters,
                PriceForUnitWithoutVat = 21.07m,
                PriceForUnitWithVat = 25.50m,
                PriceWithoutVat = 632.10m,
                PriceWithVat = 765.00m
            }
        ];
    }

    /// <summary>
    /// Retrieves products categorized as limo kegs.
    /// </summary>
    /// <returns></returns>
    public static List<Product> GetSampleLimoKegProducts()
    {
        return
        [
            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanela Pomeranč",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 8.02m,
                PriceForUnitWithVat = 9.70m,
                PriceWithoutVat = 481.20m,
                PriceWithVat = 582.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanela Pomeranč",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 8.02m,
                PriceForUnitWithVat = 9.70m,
                PriceWithoutVat = 802.00m,
                PriceWithVat = 970.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanela Herbal Cola",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 8.02m,
                PriceForUnitWithVat = 9.70m,
                PriceWithoutVat = 481.20m,
                PriceWithVat = 582.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanela Herbal Cola",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 8.02m,
                PriceForUnitWithVat = 9.70m,
                PriceWithoutVat = 802.00m,
                PriceWithVat = 970.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanela Malina",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 8.02m,
                PriceForUnitWithVat = 9.70m,
                PriceWithoutVat = 481.20m,
                PriceWithVat = 582.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanela Malina",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 8.02m,
                PriceForUnitWithVat = 9.70m,
                PriceWithoutVat = 802.00m,
                PriceWithVat = 970.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanela Hrozno",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 8.02m,
                PriceForUnitWithVat = 9.70m,
                PriceWithoutVat = 481.20m,
                PriceWithVat = 582.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanela Hrozno",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 8.02m,
                PriceForUnitWithVat = 9.70m,
                PriceWithoutVat = 802.00m,
                PriceWithVat = 970.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanela Mango",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 8.02m,
                PriceForUnitWithVat = 9.70m,
                PriceWithoutVat = 481.20m,
                PriceWithVat = 582.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanela Mango",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 8.02m,
                PriceForUnitWithVat = 9.70m,
                PriceWithoutVat = 802.00m,
                PriceWithVat = 970.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanela Citrón",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.ThirtyLiters,
                PriceForUnitWithoutVat = 8.02m,
                PriceForUnitWithVat = 9.70m,
                PriceWithoutVat = 481.20m,
                PriceWithVat = 582.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanela Citrón",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 8.02m,
                PriceForUnitWithVat = 9.70m,
                PriceWithoutVat = 802.00m,
                PriceWithVat = 970.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Soda",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.FiftyLiters,
                PriceForUnitWithoutVat = 5.74m,
                PriceForUnitWithVat = 6.95m,
                PriceWithoutVat = 574.38m,
                PriceWithVat = 695.00m
            }
        ];
    }

    /// <summary>
    /// Retrieves products that are categorized as multipacks.
    /// </summary>
    /// <returns></returns>
    public static List<Product> GetSampleMultipackProducts()
    {
        return
        [
            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Máz - 8x",
                Kind = ProductKind.Multipack,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 138.02m,
                PriceWithVat = 167.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijany 450 - 8x",
                Kind = ProductKind.Multipack,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FourPointSix,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 156.20m,
                PriceWithVat = 189.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Rytíř - 8x",
                Kind = ProductKind.Multipack,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 145.45m,
                PriceWithVat = 176.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Kníže - 8x",
                Kind = ProductKind.Multipack,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointSix,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 159.50m,
                PriceWithVat = 193.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijany - 7 svijanských kousků",
                Kind = ProductKind.Multipack,
                Type = ProductType.Mix,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 146.28m,
                PriceWithVat = 177.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijany 6 piv + sklenička",
                Kind = ProductKind.Multipack,
                Type = ProductType.Mix,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 167.36m,
                PriceWithVat = 202.50m
            }
        ];
    }

    /// <summary>
    /// Retrieves products of type can with a volume of 0.5 liters.
    /// </summary>
    /// <returns></returns>
    public static List<Product> GetSampleCanZeroPointFiveProducts()
    {
        return
        [
            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Shine",
                Kind = ProductKind.Can,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.TwoPointNine,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 17.69m,
                PriceForUnitWithVat = 21.40m,
                PriceWithVat = 256.80m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanská Desítka",
                Kind = ProductKind.Can,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.Four,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 17.27m,
                PriceForUnitWithVat = 20.90m,
                PriceWithVat = 501.60m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Máz",
                Kind = ProductKind.Can,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 18.10m,
                PriceForUnitWithVat = 21.90m,
                PriceWithVat = 525.60m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijany 450",
                Kind = ProductKind.Can,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FourPointSix,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 18.93m,
                PriceForUnitWithVat = 22.90m,
                PriceWithVat = 549.60m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Rytíř",
                Kind = ProductKind.Can,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 18.93m,
                PriceForUnitWithVat = 22.90m,
                PriceWithVat = 549.60m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Kníže",
                Kind = ProductKind.Can,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointSix,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 19.42m,
                PriceForUnitWithVat = 23.50m,
                PriceWithVat = 564.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanská Kněžna",
                Kind = ProductKind.Can,
                Type = ProductType.DarkStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointTwo,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 19.75m,
                PriceForUnitWithVat = 23.90m,
                PriceWithVat = 573.60m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Baron",
                Kind = ProductKind.Can,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.SixPointFive,
                PlatoDegree = PlatoDegree.Fifteen,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 21.07m,
                PriceForUnitWithVat = 25.50m,
                PriceWithVat = 612.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Vozka",
                Kind = ProductKind.Can,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 18.10m,
                PriceForUnitWithVat = 21.90m,
                PriceWithVat = 262.90m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Vozka černý rybíz & limetka",
                Kind = ProductKind.Can,
                Type = ProductType.NonAlcoholicFlavourBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 20.66m,
                PriceForUnitWithVat = 25.00m,
                PriceWithVat = 300.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Vozka yuzu & bergamot",
                Kind = ProductKind.Can,
                Type = ProductType.NonAlcoholicFlavourBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 20.66m,
                PriceForUnitWithVat = 25.00m,
                PriceWithVat = 300.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "6-Pack mix svijanských piv",
                Kind = ProductKind.Can,
                Type = ProductType.Mix,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceForUnitWithoutVat = 120.58m,
                PriceForUnitWithVat = 145.90m,
                PriceWithVat = 583.60m
            }
        ];
    }

    /// <summary>
    /// Retrieves a collection of products of type can with a volume of 0.33 liters.
    /// </summary>
    /// <returns>A collection of products matching the specified type and volume.</returns>
    public static List<Product> GetSampleCanZeroPointThreeProducts()
    {
        return
        [
            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijany 450",
                Kind = ProductKind.Can,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FourPointSix,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = CanSize.ZeroPointThreeThreeLiters,
                PriceForUnitWithoutVat = 18.10m,
                PriceForUnitWithVat = 21.90m,
                PriceWithVat = 525.60m
            }
        ];
    }

    /// <summary>
    /// Retrieves products of type two-liter can.
    /// </summary>
    /// <returns></returns>
    public static List<Product> GetSampleTwoLiterCanProducts()
    {
        return
        [
            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Máz",
                Kind = ProductKind.Can,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = CanSize.TwoLiters,
                PriceForUnitWithoutVat = 119.83m,
                PriceWithVat = 145.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Šlik",
                Kind = ProductKind.Can,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FourPointFour,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = CanSize.TwoLiters,
                PriceForUnitWithoutVat = 123.14m,
                PriceWithVat = 149.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Zámek",
                Kind = ProductKind.Can,
                Type = ProductType.YeastLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = CanSize.TwoLiters,
                PriceForUnitWithoutVat = 128.93m,
                PriceWithVat = 156.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijany 450",
                Kind = ProductKind.Can,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FourPointSix,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = CanSize.TwoLiters,
                PriceForUnitWithoutVat = 129.75m,
                PriceWithVat = 157.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Rytíř",
                Kind = ProductKind.Can,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = CanSize.TwoLiters,
                PriceForUnitWithoutVat = 123.97m,
                PriceWithVat = 150.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Kníže",
                Kind = ProductKind.Can,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointSix,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = CanSize.TwoLiters,
                PriceForUnitWithoutVat = 132.20m,
                PriceWithVat = 160.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Baron",
                Kind = ProductKind.Can,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.SixPointFive,
                PlatoDegree = PlatoDegree.Fifteen,
                PackageSize = CanSize.TwoLiters,
                PriceForUnitWithoutVat = 137.19m,
                PriceWithVat = 166.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Dux",
                Kind = ProductKind.Can,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointFive,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = CanSize.TwoLiters,
                PriceForUnitWithoutVat = 139.67m,
                PriceWithVat = 169.00m
            }
        ];
    }

    /// <summary>
    /// Retrieves a collection of products specifically in five-liter keg format.
    /// </summary>
    /// <returns></returns>
    public static List<Product> GetSampleFiveLiterKegProducts()
    {
        return
        [
            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Máz",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FiveLiters,
                PriceForUnitWithoutVat = 275.21m,
                PriceWithVat = 333.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijany 450",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FourPointSix,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FiveLiters,
                PriceForUnitWithoutVat = 295.04m,
                PriceWithVat = 357.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Šlik",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointFour,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FiveLiters,
                PriceForUnitWithoutVat = 295.04m,
                PriceWithVat = 357.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Rytíř",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.FiveLiters,
                PriceForUnitWithoutVat = 280.99m,
                PriceWithVat = 340.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Kníže",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointSix,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.FiveLiters,
                PriceForUnitWithoutVat = 290.08m,
                PriceWithVat = 351.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Kvasničák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.Six,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.FiveLiters,
                PriceForUnitWithoutVat = 290.08m,
                PriceWithVat = 351.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Fanda",
                Kind = ProductKind.Keg,
                Type = ProductType.UnfilteredBlendedLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FiveLiters,
                PriceForUnitWithoutVat = 280.99m,
                PriceWithVat = 340.00m
            }
        ];
    }

    /// <summary>
    /// Retrieves a collection of decorative bottle products.
    /// </summary>
    /// <returns></returns>
    public static List<Product> GetSampleDecorativeBottleProducts()
    {
        return
        [
            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Kvasničák",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.Six,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = BottleSize.TwoLiters,
                PriceForUnitWithoutVat = 404.96m,
                PriceWithVat = 490.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Kvasničák",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.Six,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = BottleSize.OneLiter,
                PriceForUnitWithoutVat = 135.54m,
                PriceForUnitWithVat = 164.00m,
                PriceWithVat = 164.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijanský Fanda",
                Kind = ProductKind.Bottle,
                Type = ProductType.UnfilteredBlendedLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.OneLiter,
                PriceForUnitWithoutVat = 128.10m,
                PriceWithVat = 155.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Pivo přímo ze sklepa lahev",
                Kind = ProductKind.Bottle,
                Type = ProductType.OriginalCraftLager,
                AlcoholPercentage = AlcoholPercentage.FourPointNine,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.OneLiter,
                PriceForUnitWithoutVat = 81.82m,
                PriceForUnitWithVat = 99.00m,
                PriceWithVat = 99.00m
            },

            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijany 20 - výroční pivo",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.NinePointFive,
                PlatoDegree = PlatoDegree.Twenty,
                PackageSize = BottleSize.OneLiter,
                PriceForUnitWithoutVat = 94.21m,
                PriceWithVat = 114.00m
            }
        ];
    }

    /// <summary>
    /// Retrieves products that are packaged as duo packs.
    /// </summary>
    /// <returns></returns>
    public static List<Product> GetSampleDuoPackProducts()
    {
        return
        [
            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Svijany 450",
                Kind = ProductKind.Multipack,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FourPointSix,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.OneLiter,
                PriceForUnitWithoutVat = 43.72m,
                PriceWithVat = 92.90m
            },
            
            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Řízni si kněžnu",
                Description = "Svijanský kníže 1ks, Svijanská kněžna 1ks",
                Kind = ProductKind.Multipack,
                Type = ProductType.MixedLager,
                AlcoholPercentage = AlcoholPercentage.FivePointSix,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = BottleSize.OneLiter,
                PriceForUnitWithoutVat = 43.72m,
                PriceWithVat = 92.90m
            },
        ];
    }

    /// <summary>
    /// Retrieves a list of products that are not of type bottle.
    /// </summary>
    /// <returns></returns>
    public static List<Product> GetSampleOtherProducts()
    {
        return
        [
            new Product
            {
                PublicId = Guid.NewGuid(),
                Name = "Ucho soudku",
                Kind = ProductKind.Other,
                Type = ProductType.Other,
                PriceWithVat = 30.00m
            }
        ];
    }
}