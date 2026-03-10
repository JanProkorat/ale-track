using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;

namespace AleTrack.Seeding.Builders;

public static class PrimatorProductsBuilder
{
    public static List<Product> GetPrimatorKegProducts()
    {
        return
        [
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Antonín",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.Four,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 1495.87m,
                PriceWithVat = 1810.00m,
                PriceForUnitWithoutVat = 14.96m,
                PriceForUnitWithVat = 18.10m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Antonín",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.Four,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 912.40m,
                PriceWithVat = 1104.00m,
                PriceForUnitWithoutVat = 15.21m,
                PriceForUnitWithVat = 18.40m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Antonín",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.Four,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 480.99m,
                PriceWithVat = 582.00m,
                PriceForUnitWithoutVat = 16.03m,
                PriceForUnitWithVat = 19.40m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Ležák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointSeven,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 1694.21m,
                PriceWithVat = 2050.00m,
                PriceForUnitWithoutVat = 16.94m,
                PriceForUnitWithVat = 20.50m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Ležák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointSeven,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1031.40m,
                PriceWithVat = 1248.00m,
                PriceForUnitWithoutVat = 17.19m,
                PriceForUnitWithVat = 20.80m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Ležák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointSeven,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 555.37m,
                PriceWithVat = 672.00m,
                PriceForUnitWithoutVat = 18.51m,
                PriceForUnitWithVat = 22.40m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Ležák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointSeven,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.TwentyLiters,
                PriceWithoutVat = 823.14m,
                PriceWithVat = 996.00m,
                PriceForUnitWithoutVat = 20.58m,
                PriceForUnitWithVat = 24.90m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Ležák nefiltrovaný",
                Kind = ProductKind.Keg,
                Type = ProductType.YeastLager,
                AlcoholPercentage = AlcoholPercentage.FourPointSeven,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 1694.21m,
                PriceWithVat = 2050.00m,
                PriceForUnitWithoutVat = 16.94m,
                PriceForUnitWithVat = 20.50m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Ležák nefiltrovaný",
                Kind = ProductKind.Keg,
                Type = ProductType.YeastLager,
                AlcoholPercentage = AlcoholPercentage.FourPointSeven,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1031.40m,
                PriceWithVat = 1248.00m,
                PriceForUnitWithoutVat = 17.19m,
                PriceForUnitWithVat = 20.80m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Ležák nefiltrovaný",
                Kind = ProductKind.Keg,
                Type = ProductType.YeastLager,
                AlcoholPercentage = AlcoholPercentage.FourPointSeven,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 555.37m,
                PriceWithVat = 672.00m,
                PriceForUnitWithoutVat = 18.51m,
                PriceForUnitWithVat = 22.40m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Premium",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 1768.60m,
                PriceWithVat = 2140.00m,
                PriceForUnitWithoutVat = 17.69m,
                PriceForUnitWithVat = 21.40m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Premium",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1076.03m,
                PriceWithVat = 1302.00m,
                PriceForUnitWithoutVat = 17.93m,
                PriceForUnitWithVat = 21.70m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Premium",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 572.73m,
                PriceWithVat = 693.00m,
                PriceForUnitWithoutVat = 19.09m,
                PriceForUnitWithVat = 23.70m
            },

            // Dark
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Dark",
                Kind = ProductKind.Keg,
                Type = ProductType.DarkLager,
                AlcoholPercentage = AlcoholPercentage.FourPointFive,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1085.95m,
                PriceWithVat = 1314.00m,
                PriceForUnitWithoutVat = 18.10m,
                PriceForUnitWithVat = 21.90m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Dark",
                Kind = ProductKind.Keg,
                Type = ProductType.DarkLager,
                AlcoholPercentage = AlcoholPercentage.FourPointFive,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 577.69m,
                PriceWithVat = 699.00m,
                PriceForUnitWithoutVat = 19.26m,
                PriceForUnitWithVat = 23.30m
            },

            // 13 Polotmavé
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Polotmavé",
                Kind = ProductKind.Keg,
                Type = ProductType.AmberLager,
                AlcoholPercentage = AlcoholPercentage.FivePointFive,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1120.66m,
                PriceWithVat = 1356.00m,
                PriceForUnitWithoutVat = 18.68m,
                PriceForUnitWithVat = 22.60m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Polotmavé",
                Kind = ProductKind.Keg,
                Type = ProductType.AmberLager,
                AlcoholPercentage = AlcoholPercentage.FivePointFive,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 595.04m,
                PriceWithVat = 720.00m,
                PriceForUnitWithoutVat = 19.83m,
                PriceForUnitWithVat = 24.00m
            },

            // 16 Exkluziv
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Exkluziv",
                Kind = ProductKind.Keg,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.SevenPointFive,
                PlatoDegree = PlatoDegree.Sixteen,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1175.21m,
                PriceWithVat = 1422.00m,
                PriceForUnitWithoutVat = 19.59m,
                PriceForUnitWithVat = 23.70m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Exkluziv",
                Kind = ProductKind.Keg,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.SevenPointFive,
                PlatoDegree = PlatoDegree.Sixteen,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 624.79m,
                PriceWithVat = 756.00m,
                PriceForUnitWithoutVat = 20.83m,
                PriceForUnitWithVat = 25.20m
            },

            // 21 Imperial
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Imperial",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.Nine,
                PlatoDegree = PlatoDegree.TwentyOne,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1423.14m,
                PriceWithVat = 1722.00m,
                PriceForUnitWithoutVat = 23.72m,
                PriceForUnitWithVat = 28.70m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Imperial",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.Nine,
                PlatoDegree = PlatoDegree.TwentyOne,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 743.80m,
                PriceWithVat = 900.00m,
                PriceForUnitWithoutVat = 24.79m,
                PriceForUnitWithVat = 30.00m
            },

            // 24 Double
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Double",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.TenPointFive,
                PlatoDegree = PlatoDegree.TwentyFour,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1576.86m,
                PriceWithVat = 1908.00m,
                PriceForUnitWithoutVat = 26.28m,
                PriceForUnitWithVat = 31.80m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Double",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.TenPointFive,
                PlatoDegree = PlatoDegree.TwentyFour,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 820.66m,
                PriceWithVat = 993.00m,
                PriceForUnitWithoutVat = 27.36m,
                PriceForUnitWithVat = 33.10m
            },

            // Weizen
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Weizen",
                Kind = ProductKind.Keg,
                Type = ProductType.WheatBeer,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1358.68m,
                PriceWithVat = 1644.00m,
                PriceForUnitWithoutVat = 22.64m,
                PriceForUnitWithVat = 27.40m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Weizen",
                Kind = ProductKind.Keg,
                Type = ProductType.WheatBeer,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 706.61m,
                PriceWithVat = 855.00m,
                PriceForUnitWithoutVat = 23.55m,
                PriceForUnitWithVat = 28.50m
            },

            // EPA
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. EPA",
                Kind = ProductKind.Keg,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1353.72m,
                PriceWithVat = 1638.00m,
                PriceForUnitWithoutVat = 22.56m,
                PriceForUnitWithVat = 27.30m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. EPA",
                Kind = ProductKind.Keg,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 706.61m,
                PriceWithVat = 855.00m,
                PriceForUnitWithoutVat = 23.55m,
                PriceForUnitWithVat = 28.50m
            },

            // IPA
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. IPA",
                Kind = ProductKind.Keg,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.SixPointFive,
                PlatoDegree = PlatoDegree.Fifteen,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1552.07m,
                PriceWithVat = 1878.00m,
                PriceForUnitWithoutVat = 25.87m,
                PriceForUnitWithVat = 31.30m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. IPA",
                Kind = ProductKind.Keg,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.SixPointFive,
                PlatoDegree = PlatoDegree.Fifteen,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 818.18m,
                PriceWithVat = 990.00m,
                PriceForUnitWithoutVat = 27.27m,
                PriceForUnitWithVat = 33.00m
            },

            // APA
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. APA",
                Kind = ProductKind.Keg,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1393.39m,
                PriceWithVat = 1686.00m,
                PriceForUnitWithoutVat = 23.22m,
                PriceForUnitWithVat = 28.10m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. APA",
                Kind = ProductKind.Keg,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 706.50m,
                PriceWithVat = 854.87m,
                PriceForUnitWithoutVat = 23.55m,
                PriceForUnitWithVat = 28.50m
            },

            // Stout
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Stout",
                Kind = ProductKind.Keg,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1353.72m,
                PriceWithVat = 1638.00m,
                PriceForUnitWithoutVat = 22.56m,
                PriceForUnitWithVat = 27.30m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Stout",
                Kind = ProductKind.Keg,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 706.61m,
                PriceWithVat = 855.00m,
                PriceForUnitWithoutVat = 23.55m,
                PriceForUnitWithVat = 28.50m
            },

            // Tchyně
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Tchyně",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointSeven,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1244.63m,
                PriceWithVat = 1506.00m,
                PriceForUnitWithoutVat = 20.74m,
                PriceForUnitWithVat = 25.10m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Tchyně",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointSeven,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 652.07m,
                PriceWithVat = 789.00m,
                PriceForUnitWithoutVat = 21.74m,
                PriceForUnitWithVat = 26.30m
            },

            // FREE Tchyně
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. FREE Tchyně",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 967.20m,
                PriceWithVat = 1170.31m,
                PriceForUnitWithoutVat = 16.12m,
                PriceForUnitWithVat = 19.50m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. FREE Tchyně",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 518.10m,
                PriceWithVat = 626.90m,
                PriceForUnitWithoutVat = 17.27m,
                PriceForUnitWithVat = 20.90m
            },

            // N – Nealko
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Nealko",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 942.15m,
                PriceWithVat = 1140.00m,
                PriceForUnitWithoutVat = 15.70m,
                PriceForUnitWithVat = 19.00m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Nealko",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 497.11m,
                PriceWithVat = 601.50m,
                PriceForUnitWithoutVat = 16.57m,
                PriceForUnitWithVat = 20.05m
            },

            // N – Nealko černý rybíz a limetka
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Nealko rybíz a limetka",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicFlavourBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointThree,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1020.50m,
                PriceWithVat = 1234.80m,
                PriceForUnitWithoutVat = 17.01m,
                PriceForUnitWithVat = 20.58m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Nealko rybíz a limetka",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicFlavourBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointThree,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 533.80m,
                PriceWithVat = 645.90m,
                PriceForUnitWithoutVat = 17.79m,
                PriceForUnitWithVat = 21.53m
            },

            // N – Nealko tropický citrus yuzu
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Nealko citrus yuzu",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicFlavourBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointThree,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1020.50m,
                PriceWithVat = 1234.80m,
                PriceForUnitWithoutVat = 17.01m,
                PriceForUnitWithVat = 20.58m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Nealko citrus yuzu",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicFlavourBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointThree,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 533.80m,
                PriceWithVat = 645.90m,
                PriceForUnitWithoutVat = 17.79m,
                PriceForUnitWithVat = 21.53m
            },

            // HRON Světlý ležák
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Hron Světlý ležák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointNine,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 1776.86m,
                PriceWithVat = 2150.00m,
                PriceForUnitWithoutVat = 17.77m,
                PriceForUnitWithVat = 21.50m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Hron Světlý ležák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointNine,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1080.99m,
                PriceWithVat = 1308.00m,
                PriceForUnitWithoutVat = 18.02m,
                PriceForUnitWithVat = 21.80m
            },

            // CHIPPER Grep
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. CHIPPER Grep",
                Kind = ProductKind.Keg,
                Type = ProductType.Radler,
                AlcoholPercentage = AlcoholPercentage.Two,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1006.61m,
                PriceWithVat = 1218.00m,
                PriceForUnitWithoutVat = 16.78m,
                PriceForUnitWithVat = 20.30m
            },

            // limo MALINA
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. limo Malina",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 894.21m,
                PriceWithVat = 1082.00m,
                PriceForUnitWithoutVat = 8.94m,
                PriceForUnitWithVat = 10.82m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. limo Malina",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 551.90m,
                PriceWithVat = 667.80m,
                PriceForUnitWithoutVat = 9.20m,
                PriceForUnitWithVat = 11.13m
            },

            // limo COLA
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. limo Cola",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 894.21m,
                PriceWithVat = 1082.00m,
                PriceForUnitWithoutVat = 8.94m,
                PriceForUnitWithVat = 10.82m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. limo Cola",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 551.90m,
                PriceWithVat = 667.80m,
                PriceForUnitWithoutVat = 9.20m,
                PriceForUnitWithVat = 11.13m
            },

            // limo HROZNO
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. limo Hrozno",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 894.21m,
                PriceWithVat = 1082.00m,
                PriceForUnitWithoutVat = 8.94m,
                PriceForUnitWithVat = 10.82m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. limo Hrozno",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 551.90m,
                PriceWithVat = 667.80m,
                PriceForUnitWithoutVat = 9.20m,
                PriceForUnitWithVat = 11.13m
            }
        ];
    }

    public static List<Product> GetPrimatorBottleProducts()
    {
        return
        [
            // 0.5l Bottles
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Antonín",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.Four,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 248.60m,
                PriceWithVat = 300.81m,
                PriceForUnitWithoutVat = 12.43m,
                PriceForUnitWithVat = 15.04m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Ležák",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointSeven,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 298.60m,
                PriceWithVat = 361.31m,
                PriceForUnitWithoutVat = 14.93m,
                PriceForUnitWithVat = 18.07m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Premium",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 311.00m,
                PriceWithVat = 376.31m,
                PriceForUnitWithoutVat = 15.55m,
                PriceForUnitWithVat = 18.82m
            },

            // 0.33l Bottle
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Premium",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = BottleSize.ZeroPointThreeThreeLiters,
                PriceWithoutVat = 348.24m,
                PriceWithVat = 421.37m,
                PriceForUnitWithoutVat = 14.51m,
                PriceForUnitWithVat = 17.56m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Dark",
                Kind = ProductKind.Bottle,
                Type = ProductType.DarkLager,
                AlcoholPercentage = AlcoholPercentage.FourPointFive,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 311.00m,
                PriceWithVat = 376.31m,
                PriceForUnitWithoutVat = 15.55m,
                PriceForUnitWithVat = 18.82m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Polotmavé",
                Kind = ProductKind.Bottle,
                Type = ProductType.AmberLager,
                AlcoholPercentage = AlcoholPercentage.FivePointFive,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 325.20m,
                PriceWithVat = 393.49m,
                PriceForUnitWithoutVat = 16.26m,
                PriceForUnitWithVat = 19.67m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Exkluziv",
                Kind = ProductKind.Bottle,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.SevenPointFive,
                PlatoDegree = PlatoDegree.Sixteen,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 359.20m,
                PriceWithVat = 434.63m,
                PriceForUnitWithoutVat = 17.96m,
                PriceForUnitWithVat = 21.73m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Imperial",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.Nine,
                PlatoDegree = PlatoDegree.TwentyOne,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 431.00m,
                PriceWithVat = 521.51m,
                PriceForUnitWithoutVat = 21.55m,
                PriceForUnitWithVat = 26.08m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Double",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.TenPointFive,
                PlatoDegree = PlatoDegree.TwentyFour,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 484.00m,
                PriceWithVat = 585.64m,
                PriceForUnitWithoutVat = 24.20m,
                PriceForUnitWithVat = 29.28m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Weizen",
                Kind = ProductKind.Bottle,
                Type = ProductType.WheatBeer,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 423.40m,
                PriceWithVat = 512.31m,
                PriceForUnitWithoutVat = 21.17m,
                PriceForUnitWithVat = 25.62m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. EPA",
                Kind = ProductKind.Bottle,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 420.80m,
                PriceWithVat = 509.17m,
                PriceForUnitWithoutVat = 21.04m,
                PriceForUnitWithVat = 25.46m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. IPA",
                Kind = ProductKind.Bottle,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.SixPointFive,
                PlatoDegree = PlatoDegree.Fifteen,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 509.80m,
                PriceWithVat = 616.86m,
                PriceForUnitWithoutVat = 25.49m,
                PriceForUnitWithVat = 30.84m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. APA",
                Kind = ProductKind.Bottle,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 420.00m,
                PriceWithVat = 508.20m,
                PriceForUnitWithoutVat = 21.00m,
                PriceForUnitWithVat = 25.41m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Stout",
                Kind = ProductKind.Bottle,
                Type = ProductType.SpecialBeer,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 433.20m,
                PriceWithVat = 524.17m,
                PriceForUnitWithoutVat = 21.66m,
                PriceForUnitWithVat = 26.21m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Tchyně",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointSeven,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 367.20m,
                PriceWithVat = 444.31m,
                PriceForUnitWithoutVat = 18.36m,
                PriceForUnitWithVat = 22.22m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. FREE Tchyně",
                Kind = ProductKind.Bottle,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 330.00m,
                PriceWithVat = 399.40m,
                PriceForUnitWithoutVat = 16.50m,
                PriceForUnitWithVat = 19.97m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. FREE Tchyně pomelo",
                Kind = ProductKind.Bottle,
                Type = ProductType.NonAlcoholicFlavourBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointThree,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 336.00m,
                PriceWithVat = 406.56m,
                PriceForUnitWithoutVat = 16.80m,
                PriceForUnitWithVat = 20.33m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Nealko",
                Kind = ProductKind.Bottle,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 239.20m,
                PriceWithVat = 289.43m,
                PriceForUnitWithoutVat = 11.96m,
                PriceForUnitWithVat = 14.47m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Chipper Grap",
                Kind = ProductKind.Bottle,
                Type = ProductType.Radler,
                AlcoholPercentage = AlcoholPercentage.Two,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 350.80m,
                PriceWithVat = 424.47m,
                PriceForUnitWithoutVat = 17.54m,
                PriceForUnitWithVat = 21.22m
            },

            // 0.33l Limo Bottles
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. limo Soda",
                Kind = ProductKind.Bottle,
                Type = ProductType.Lemonade,
                PackageSize = BottleSize.ZeroPointThreeThreeLiters,
                PriceWithoutVat = 144.00m,
                PriceWithVat = 174.24m,
                PriceForUnitWithoutVat = 6.00m,
                PriceForUnitWithVat = 7.26m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. limo Malina",
                Kind = ProductKind.Bottle,
                Type = ProductType.Lemonade,
                PackageSize = BottleSize.ZeroPointThreeThreeLiters,
                PriceWithoutVat = 216.00m,
                PriceWithVat = 261.36m,
                PriceForUnitWithoutVat = 9.00m,
                PriceForUnitWithVat = 10.89m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. limo Cola",
                Kind = ProductKind.Bottle,
                Type = ProductType.Lemonade,
                PackageSize = BottleSize.ZeroPointThreeThreeLiters,
                PriceWithoutVat = 216.00m,
                PriceWithVat = 261.36m,
                PriceForUnitWithoutVat = 9.00m,
                PriceForUnitWithVat = 10.89m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. limo Hrozno",
                Kind = ProductKind.Bottle,
                Type = ProductType.Lemonade,
                PackageSize = BottleSize.ZeroPointThreeThreeLiters,
                PriceWithoutVat = 216.00m,
                PriceWithVat = 261.36m,
                PriceForUnitWithoutVat = 9.00m,
                PriceForUnitWithVat = 10.89m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. limo Multivitamin",
                Kind = ProductKind.Bottle,
                Type = ProductType.Lemonade,
                PackageSize = BottleSize.ZeroPointThreeThreeLiters,
                PriceWithoutVat = 216.00m,
                PriceWithVat = 261.36m,
                PriceForUnitWithoutVat = 9.00m,
                PriceForUnitWithVat = 10.89m
            }
        ];
    }

    public static List<Product> GetPrimatorMultipackProducts()
    {
        return
        [
            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Premium 8x",
                Kind = ProductKind.Multipack,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithVat = 159.72m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Osm zlatých 8x",
                Kind = ProductKind.Multipack,
                Type = ProductType.Mix,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithVat = 169.40m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Top line 8x",
                Kind = ProductKind.Multipack,
                Type = ProductType.Mix,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithVat = 193.60m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name ="Prim. Tchyně 8x",
                Kind = ProductKind.Multipack,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointSeven,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithVat = 187.55m
            }
        ];
    }

    public static List<Product> GetPrimatorCanProducts()
    {
        return
        [
            // 0.5l Cans
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Prim. Ležák",
                Kind = ProductKind.Can,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointSeven,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceWithoutVat = 182.40m,
                PriceWithVat = 220.70m,
                PriceForUnitWithoutVat = 15.20m,
                PriceForUnitWithVat = 18.39m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Prim. Premium",
                Kind = ProductKind.Can,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.Five,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceWithoutVat = 194.40m,
                PriceWithVat = 235.22m,
                PriceForUnitWithoutVat = 16.20m,
                PriceForUnitWithVat = 19.60m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Prim. Tchyně",
                Kind = ProductKind.Can,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointSeven,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceWithoutVat = 198.00m,
                PriceWithVat = 239.58m,
                PriceForUnitWithoutVat = 16.50m,
                PriceForUnitWithVat = 19.97m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Prim. FREE Tchyně",
                Kind = ProductKind.Can,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceWithoutVat = 192.00m,
                PriceWithVat = 232.32m,
                PriceForUnitWithoutVat = 16.00m,
                PriceForUnitWithVat = 19.36m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Prim. FREE Tchyně pomelo",
                Kind = ProductKind.Can,
                Type = ProductType.NonAlcoholicFlavourBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointThree,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceWithoutVat = 195.60m,
                PriceWithVat = 236.68m,
                PriceForUnitWithoutVat = 16.30m,
                PriceForUnitWithVat = 19.70m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Prim. Nealko rybíz a limetka",
                Kind = ProductKind.Can,
                Type = ProductType.NonAlcoholicFlavourBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointThree,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceWithoutVat = 179.76m,
                PriceWithVat = 217.51m,
                PriceForUnitWithoutVat = 14.98m,
                PriceForUnitWithVat = 18.13m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Prim. Nealko citrus yuzu",
                Kind = ProductKind.Can,
                Type = ProductType.NonAlcoholicFlavourBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointThree,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceWithoutVat = 179.76m,
                PriceWithVat = 217.51m,
                PriceForUnitWithoutVat = 14.98m,
                PriceForUnitWithVat = 18.13m
            }
        ];
    }
}