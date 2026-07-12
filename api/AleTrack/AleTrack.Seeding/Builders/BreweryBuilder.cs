using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Seeding.Builders;

internal static class BreweryBuilder
{
    public static Brewery CreateSvijany() =>
        new ()
        {
            DisplayOrder = 1,
            Color = "#f52b07",
            Name = "Svijany",
            PublicId = Guid.Parse("e0681a30-b323-4df9-a670-a290e1ac990c"),
            OfficialAddress = new Address
            { 
                StreetName = "Svijany",
                StreetNumber = "25",
                City = "Svijany",
                Zip = "46346",
                Country = Country.Czechia
            },
            ContactAddress = new Address
            {
                StreetName = "Sladovnická",
                StreetNumber = "1685",
                City = "Vratislavice nad Nisou",
                Zip = "463 11",
                Country = Country.Czechia
            }
        };
    
    public static Brewery CreateRohozec() =>
        new ()
        {
            DisplayOrder = 2,
            Color = "#f5e107",
            Name = "Rohozec",
            PublicId = Guid.Parse("77a0d351-e49d-4341-b443-18459c0122aa"),
            OfficialAddress = new Address
            {
                StreetName = "Malý Rohozec",
                StreetNumber = "29",
                City = "Turnov",
                Zip = "51101",
                Country = Country.Czechia
            }
        };
    
    public static Brewery CreatePrimator() =>
        new ()
        {
            DisplayOrder = 3,
            Color = "#0fa699",
            Name = "Primátor",
            PublicId = Guid.Parse("8ec5d390-b750-4231-9dc2-fcb2f651ed2b"),
            OfficialAddress = new Address
            {
                StreetName = "Dobrošovská",
                StreetNumber = "130",
                City = "Náchod",
                Zip = "54701",
                Country = Country.Czechia
            }
        };
}