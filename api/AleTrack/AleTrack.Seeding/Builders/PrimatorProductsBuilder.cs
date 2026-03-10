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
                PublicId = Guid.Parse("a1b2c3d4-0001-4000-8000-000000000001"),
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
                PublicId = Guid.Parse("a1b2c3d4-0002-4000-8000-000000000002"),
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
                PublicId = Guid.Parse("a1b2c3d4-0003-4000-8000-000000000003"),
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
                PublicId = Guid.Parse("a1b2c3d4-0004-4000-8000-000000000004"),
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
                PublicId = Guid.Parse("a1b2c3d4-0005-4000-8000-000000000005"),
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
                PublicId = Guid.Parse("a1b2c3d4-0006-4000-8000-000000000006"),
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
                PublicId = Guid.Parse("a1b2c3d4-0007-4000-8000-000000000007"),
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
                PublicId = Guid.Parse("a1b2c3d4-0008-4000-8000-000000000008"),
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
                PublicId = Guid.Parse("a1b2c3d4-0009-4000-8000-000000000009"),
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
                PublicId = Guid.Parse("a1b2c3d4-0010-4000-8000-000000000010"),
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
                PublicId = Guid.Parse("a1b2c3d4-0011-4000-8000-000000000011"),
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
                PublicId = Guid.Parse("a1b2c3d4-0012-4000-8000-000000000012"),
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
                PublicId = Guid.Parse("a1b2c3d4-0013-4000-8000-000000000013"),
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
                PublicId = Guid.Parse("a1b2c3d4-0014-4000-8000-000000000014"),
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
                PublicId = Guid.Parse("a1b2c3d4-0015-4000-8000-000000000015"),
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
                PublicId = Guid.Parse("a1b2c3d4-0016-4000-8000-000000000016"),
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
                PublicId = Guid.Parse("a1b2c3d4-0017-4000-8000-000000000017"),
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
                PublicId = Guid.Parse("a1b2c3d4-0018-4000-8000-000000000018"),
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
                PublicId = Guid.Parse("a1b2c3d4-0019-4000-8000-000000000019"),
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
                PublicId = Guid.Parse("a1b2c3d4-0020-4000-8000-000000000020"),
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
                PublicId = Guid.Parse("a1b2c3d4-0021-4000-8000-000000000021"),
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
                PublicId = Guid.Parse("a1b2c3d4-0022-4000-8000-000000000022"),
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
                PublicId = Guid.Parse("a1b2c3d4-0023-4000-8000-000000000023"),
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
                PublicId = Guid.Parse("a1b2c3d4-0024-4000-8000-000000000024"),
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
                PublicId = Guid.Parse("a1b2c3d4-0025-4000-8000-000000000025"),
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
                PublicId = Guid.Parse("a1b2c3d4-0026-4000-8000-000000000026"),
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
                PublicId = Guid.Parse("a1b2c3d4-0027-4000-8000-000000000027"),
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
                PublicId = Guid.Parse("a1b2c3d4-0028-4000-8000-000000000028"),
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
                PublicId = Guid.Parse("a1b2c3d4-0029-4000-8000-000000000029"),
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
                PublicId = Guid.Parse("a1b2c3d4-0030-4000-8000-000000000030"),
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
                PublicId = Guid.Parse("a1b2c3d4-0031-4000-8000-000000000031"),
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
                PublicId = Guid.Parse("a1b2c3d4-0032-4000-8000-000000000032"),
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
                PublicId = Guid.Parse("a1b2c3d4-0033-4000-8000-000000000033"),
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
                PublicId = Guid.Parse("5d8d48ac-ddb4-4430-ab40-b4dbde85eaed"),
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
                PublicId = Guid.Parse("ccf9311c-2d6c-4c7f-9a7a-20126a3da02e"),
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
                PublicId = Guid.Parse("b5bde6b8-847e-4876-b912-4f4d2439583a"),
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
                PublicId = Guid.Parse("4629131d-0268-43f4-a799-2d0c3b55705f"),
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
                PublicId = Guid.Parse("23c75327-03e5-4b67-bab5-b0c68ec5f6fd"),
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
                PublicId = Guid.Parse("8244b062-7d2a-4d3f-805b-714fc33a5cfa"),
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
                PublicId = Guid.Parse("7c2c1b20-913f-431f-931a-914b904acb63"),
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
                PublicId = Guid.Parse("58f2b8f0-9916-4bdc-af46-b9ac698cb183"),
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
                PublicId = Guid.Parse("5cfcfff5-14a5-4ea0-8663-3fe3c4edb7ec"),
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
                PublicId = Guid.Parse("0007e744-02fa-4994-ba07-d9943903d4ca"),
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
                PublicId = Guid.Parse("8cbefa29-d800-471d-9934-2a11876555d1"),
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
                PublicId = Guid.Parse("24248d04-73b0-41ab-84e7-60f700ca3ffb"),
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
                PublicId = Guid.Parse("26574c46-192a-44f6-9c76-a2061b98d4b5"),
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
                PublicId = Guid.Parse("bd6987f5-ed78-4d47-bca9-aabb4c292d67"),
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
                PublicId = Guid.Parse("c13a1a66-b159-4ffa-84dd-497fcf744d68"),
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
                PublicId = Guid.Parse("e432dbbe-70d6-49e5-b6df-cbd6f351ad17"),
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
                PublicId = Guid.Parse("1a9a5f19-09ac-42fc-bc4f-0c62c8dc5ac9"),
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
                PublicId = Guid.Parse("0ac1b1d9-4518-4ad6-bd22-b9a0620da741"),
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
                PublicId = Guid.Parse("1543d4c6-1924-4a2a-8bbf-864ccd75b529"),
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
                PublicId = Guid.Parse("40c6281d-83ae-4643-9e04-e208ca2860c4"),
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
                PublicId = Guid.Parse("eb50a88d-1cbe-47e5-8b5a-c54e4430ddf6"),
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
                PublicId = Guid.Parse("28d05533-4f25-4ad8-98e7-80d256835e0b"),
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
                PublicId = Guid.Parse("0780c7a9-3064-40e9-ad3b-0dadb83a2cdb"),
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
                PublicId = Guid.Parse("726742ac-b034-4774-b661-3547085d1d4e"),
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
                PublicId = Guid.Parse("59e329e3-bba3-46bd-9468-32f02fbc57c2"),
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
                PublicId = Guid.Parse("8658b050-20d5-456e-869f-79081cf14a59"),
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
                PublicId = Guid.Parse("55c6b9e7-0fbe-4540-84d1-ec7c2422298f"),
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
                PublicId = Guid.Parse("d98d7fe5-2012-4b2f-8519-b09442d6787f"),
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
                PublicId = Guid.Parse("9a3754f0-6ca3-4b72-8ca3-0f0be8a66a24"),
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
                PublicId = Guid.Parse("34a550cc-96f5-40df-947d-2415b7e195ee"),
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
                PublicId = Guid.Parse("a2adc2ba-42c0-401a-994a-d13a4307de46"),
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
                PublicId = Guid.Parse("61fee2f5-48b3-4382-9dd6-c008c64e2fa9"),
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
                PublicId = Guid.Parse("76298ed3-ee28-4225-8500-80a0ff1a238b"),
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
                PublicId = Guid.Parse("1f5620e9-00b4-41b0-9911-40afa9ec3367"),
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
                PublicId = Guid.Parse("9a222d9c-abf3-4ed4-b243-14e1a1cf8f3b"),
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
                PublicId = Guid.Parse("0a8670c0-c501-4f1d-bfb5-fa047dcfeb88"),
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
                PublicId = Guid.Parse("cd4bd1cc-8edb-476e-87f7-cb8f8f2b3474"),
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
                PublicId = Guid.Parse("da8a9414-80af-4511-9370-4e0c8538f722"),
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
                PublicId = Guid.Parse("01ae4723-cf24-4145-b5b7-8fd9cc90c2bb"),
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
                PublicId = Guid.Parse("90bf724f-e407-4f91-bcb8-2b3079f0c9e2"),
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
                PublicId = Guid.Parse("a7d9688d-5f9e-4b34-8d39-2412b093b834"),
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
                PublicId = Guid.Parse("759062d9-1810-45c2-8856-88f073776c04"),
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
                PublicId = Guid.Parse("41aea878-898f-4280-90c5-54d7675ca530"),
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
                PublicId = Guid.Parse("dc5cc034-ad0b-4187-a965-a41b5d0da8d5"),
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
                PublicId = Guid.Parse("3851ba99-bdfb-4f03-8bb6-e052b2a46334"),
                Name ="Prim. Osm zlatých 8x",
                Kind = ProductKind.Multipack,
                Type = ProductType.Mix,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithVat = 169.40m
            },

            new()
            {
                PublicId = Guid.Parse("b9fb168c-363a-448a-8168-857efa6503ea"),
                Name ="Prim. Top line 8x",
                Kind = ProductKind.Multipack,
                Type = ProductType.Mix,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithVat = 193.60m
            },

            new()
            {
                PublicId = Guid.Parse("05408597-e3b0-4a5b-986a-3fbd8e42add1"),
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
                PublicId = Guid.Parse("d9eda329-814d-4182-9924-d019d822773b"),
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
                PublicId = Guid.Parse("964e6456-e819-42df-82ee-47ee99f94683"),
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
                PublicId = Guid.Parse("134e72d9-6e64-46e7-96c2-b66438f92fff"),
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
                PublicId = Guid.Parse("de9f5552-2353-4074-9a97-1a5275c66c9e"),
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
                PublicId = Guid.Parse("9e96586f-9237-4bf5-8081-5c1505cbf7a7"),
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
                PublicId = Guid.Parse("948e95f8-d5b3-4b1a-a869-7f04f09cce51"),
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
                PublicId = Guid.Parse("cae6b6e6-e808-4281-864c-fe4b2340d7fd"),
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