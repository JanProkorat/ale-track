using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;

namespace AleTrack.Seeding.Builders;

public static class RohozecProductsBuilder
{
    public static List<Product> GetRohozecKegProducts()
    {
        return
        [
            // ROHOZEC Nealko - světlé nealkoholické pivo
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Nealko",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 863.64m,
                PriceWithVat = 1045.00m,
                PriceForUnitWithVat = 17.42m
            },

            // ROHOZEC Nealko Pomelo - míchaný nápoj z nealkoholického piva
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Nealko Pomelo",
                Kind = ProductKind.Keg,
                Type = ProductType.NonAlcoholicFlavourBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1000.00m,
                PriceWithVat = 1210.00m,
                PriceForUnitWithVat = 20.17m
            },

            // ROHOZEC Podskalák - světlé výčepní pivo 4,2%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Podskalák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.FourPointTwo,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 1454.55m,
                PriceWithVat = 1760.00m,
                PriceForUnitWithVat = 17.60m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Podskalák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.FourPointTwo,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 888.43m,
                PriceWithVat = 1075.00m,
                PriceForUnitWithVat = 17.92m
            },

            // ROHOZEC Y - Ypsilon - světlé výčepní pivo za studena chmelené 4,4%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Y - Ypsilon",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.FourPointFour,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 1553.72m,
                PriceWithVat = 1880.00m,
                PriceForUnitWithVat = 18.80m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Y - Ypsilon",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.FourPointFour,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 950.41m,
                PriceWithVat = 1150.00m,
                PriceForUnitWithVat = 19.17m
            },

            // ROHOZEC Skalák - světlý ležák 4,8%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Skalák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 1595.04m,
                PriceWithVat = 1930.00m,
                PriceForUnitWithVat = 19.30m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Skalák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 962.81m,
                PriceWithVat = 1165.00m,
                PriceForUnitWithVat = 19.42m
            },
            
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Skalák",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 512.40m,
                PriceWithVat = 620.00m,
                PriceForUnitWithVat = 20.67m
            },

            // ROHOZEC Kvasničák - světlý ležák kvasnicový 4,8%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Kvasničák",
                Kind = ProductKind.Keg,
                Type = ProductType.YeastLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FifteenLiters,
                PriceWithoutVat = 530.58m,
                PriceWithVat = 642.00m,
                PriceForUnitWithVat = 21.40m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Kvasničák",
                Kind = ProductKind.Keg,
                Type = ProductType.YeastLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1041.32m,
                PriceWithVat = 1260.00m,
                PriceForUnitWithVat = 21.00m
            },

            // ROHOZEC Dvanáctka - světlý ležák premium 5,3%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Dvanáctka",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FivePointThree,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 1681.82m,
                PriceWithVat = 2035.00m,
                PriceForUnitWithVat = 20.35m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Dvanáctka",
                Kind = ProductKind.Keg,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FivePointThree,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1033.06m,
                PriceWithVat = 1250.00m,
                PriceForUnitWithVat = 20.83m
            },

            // ROHOZEC Jedenáctka řezaná - řezaný ležák 4,8%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Jedenáctka řezaná",
                Kind = ProductKind.Keg,
                Type = ProductType.MixedLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 1595.04m,
                PriceWithVat = 1930.00m,
                PriceForUnitWithoutVat = 15.95m,
                PriceForUnitWithVat = 19.30m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Jedenáctka řezaná",
                Kind = ProductKind.Keg,
                Type = ProductType.MixedLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 962.81m,
                PriceWithVat = 1165.00m,
                PriceForUnitWithVat = 19.42m
            },

            // ROHOZEC Třináctka tmavá - tmavé silné pivo 5,9%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Třináctka tmavá",
                Kind = ProductKind.Keg,
                Type = ProductType.DarkStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointNine,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1140.50m,
                PriceWithVat = 1380.00m,
                PriceForUnitWithVat = 23.00m
            },

            // ROHOZEC Cherry beer - míchaný nápoj z piva s višňovou příchutí 3,9%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Cherry beer",
                Kind = ProductKind.Keg,
                Type = ProductType.FlavoredBeer,
                AlcoholPercentage = AlcoholPercentage.ThreePointNine,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 1404.96m,
                PriceWithVat = 1700.00m,
                PriceForUnitWithVat = 28.33m
            },

            // erko ORANŽ - limonáda
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "erko ORANŽ",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                AlcoholPercentage = AlcoholPercentage.Zero,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 611.57m,
                PriceWithVat = 740.00m,
                PriceForUnitWithVat = 7.40m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "erko ORANŽ",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                AlcoholPercentage = AlcoholPercentage.Zero,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 388.43m,
                PriceWithVat = 470.00m,
                PriceForUnitWithVat = 7.83m
            },

            // erko MALINA - limonáda
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "erko MALINA",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                AlcoholPercentage = AlcoholPercentage.Zero,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 611.57m,
                PriceWithVat = 740.00m,
                PriceForUnitWithVat = 7.40m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "erko MALINA",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                AlcoholPercentage = AlcoholPercentage.Zero,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 388.43m,
                PriceWithVat = 470.00m,
                PriceForUnitWithVat = 7.83m
            },

            // erko KOLA - limonáda
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "erko KOLA",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                AlcoholPercentage = AlcoholPercentage.Zero,
                PackageSize = KegSize.FiftyLiters,
                PriceWithoutVat = 611.57m,
                PriceWithVat = 740.00m,
                PriceForUnitWithVat = 7.40m
            },

            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "erko KOLA",
                Kind = ProductKind.Keg,
                Type = ProductType.Lemonade,
                AlcoholPercentage = AlcoholPercentage.Zero,
                PackageSize = KegSize.ThirtyLiters,
                PriceWithoutVat = 388.43m,
                PriceWithVat = 470.00m,
                PriceForUnitWithVat = 7.83m
            }
        ];
    }

    public static List<Product> GetRohozecBottleProducts()
    {
        return
        [
            // ROHOZEC Nealko
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Nealko",
                Kind = ProductKind.Bottle,
                Type = ProductType.NonAlcoholicBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 226.45m,
                PriceWithVat = 274.00m,
                PriceForUnitWithVat = 13.70m
            },

            // R - MIX Pomelo
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. R - MIX Pomelo",
                Kind = ProductKind.Bottle,
                Type = ProductType.FlavoredBeer,
                AlcoholPercentage = AlcoholPercentage.TwoPointTwo,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 322.31m,
                PriceWithVat = 390.00m,
                PriceForUnitWithVat = 19.50m
            },

            // ROHOZEC Skalákczech - světlé stolní pivo 3,2%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Skalákczech",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.ThreePointTwo,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 199.17m,
                PriceWithVat = 241.00m,
                PriceForUnitWithVat = 12.05m
            },

            // ROHOZEC Podskalák
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Podskalák",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.FourPointTwo,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 233.06m,
                PriceWithVat = 282.00m,
                PriceForUnitWithVat = 14.10m
            },

            // ROHOZEC Y - Ypsilon
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Y - Ypsilon",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleDraftBeer,
                AlcoholPercentage = AlcoholPercentage.FourPointFour,
                PlatoDegree = PlatoDegree.Ten,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 257.02m,
                PriceWithVat = 311.00m,
                PriceForUnitWithVat = 15.55m
            },

            // ROHOZEC Skalák
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Skalák",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 267.77m,
                PriceWithVat = 324.00m,
                PriceForUnitWithVat = 16.20m
            },

            // ROHOZEC Dvanáctka
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Dvanáctka",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleLagerPremium,
                AlcoholPercentage = AlcoholPercentage.FivePointThree,
                PlatoDegree = PlatoDegree.Twelve,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 284.30m,
                PriceWithVat = 344.00m,
                PriceForUnitWithVat = 17.20m
            },

            // ROHOZEC Třináctka - světlé silné pivo 6,0%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Třináctka",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleStrong,
                AlcoholPercentage = AlcoholPercentage.Six,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 298.35m,
                PriceWithVat = 361.00m,
                PriceForUnitWithVat = 18.05m
            },

            // ROHOZEC Jedenáctka řezaná
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Jedenáctka řezaná",
                Kind = ProductKind.Bottle,
                Type = ProductType.MixedLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 267.77m,
                PriceWithVat = 324.00m,
                PriceForUnitWithVat = 16.20m
            },

            // ROHOZEC X - Iks - tmavé výčepní pivo 4,4%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. X - Iks",
                Kind = ProductKind.Bottle,
                Type = ProductType.DarkLager,
                AlcoholPercentage = AlcoholPercentage.FourPointFour,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 264.46m,
                PriceWithVat = 320.00m,
                PriceForUnitWithVat = 16.00m
            },

            // ROHOZEC Třináctka tmavá - tmavé silné pivo 5,9%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Třináctka tmavá",
                Kind = ProductKind.Bottle,
                Type = ProductType.DarkStrong,
                AlcoholPercentage = AlcoholPercentage.FivePointNine,
                PlatoDegree = PlatoDegree.Thirteen,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 308.26m,
                PriceWithVat = 373.00m,
                PriceForUnitWithVat = 18.65m
            },

            // ROHOZEC Cherry beer
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Cherry beer",
                Kind = ProductKind.Bottle,
                Type = ProductType.FlavoredBeer,
                AlcoholPercentage = AlcoholPercentage.ThreePointNine,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PlatoDegree = PlatoDegree.Ten,
                PriceWithoutVat = 383.47m,
                PriceWithVat = 464.00m,
                PriceForUnitWithVat = 23.20m
            },

            // Cecilia - světlý ležák bez lepku 4,8%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Cecilia",
                Kind = ProductKind.Bottle,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 417.36m,
                PriceWithVat = 505.00m,
                PriceForUnitWithVat = 25.25m
            },

            // GINGER DRINK - zázvorová limonáda (OW 0,5l nevratná)
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. GINGER DRINK",
                Kind = ProductKind.Bottle,
                Type = ProductType.Lemonade,
                AlcoholPercentage = AlcoholPercentage.Zero,
                PackageSize = BottleSize.ZeroPointFiveLiters,
                PriceWithoutVat = 305.79m,
                PriceWithVat = 370.00m,
                PriceForUnitWithVat = 18.50m
            }
        ];
    }

    public static List<Product> GetRohozecCanProducts()
    {
        return
        [
            // ROHOZEC Skalák - světlý ležák 4,8%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Skalák",
                Kind = ProductKind.Can,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceWithoutVat = 213.22m,
                PriceWithVat = 258.00m,
                PriceForUnitWithVat = 21.50m
            },

            // ROHOZEC Nealko Pomelo
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Nealko Pomelo",
                Kind = ProductKind.Can,
                Type = ProductType.NonAlcoholicFlavourBeer,
                AlcoholPercentage = AlcoholPercentage.ZeroPointFive,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceWithoutVat = 218.18m,
                PriceWithVat = 264.00m,
                PriceForUnitWithVat = 22.00m
            },

            // Cecilia - světlý ležák bez lepku 4,8%
            new()
            {
                PublicId = Guid.NewGuid(),
                Name = "Roh. Cecilia",
                Kind = ProductKind.Can,
                Type = ProductType.PaleLager,
                AlcoholPercentage = AlcoholPercentage.FourPointEight,
                PlatoDegree = PlatoDegree.Eleven,
                PackageSize = CanSize.ZeroPointFiveLiters,
                PriceWithoutVat = 287.60m,
                PriceWithVat = 348.00m,
                PriceForUnitWithVat = 29.00m
            }
        ];
    }
}