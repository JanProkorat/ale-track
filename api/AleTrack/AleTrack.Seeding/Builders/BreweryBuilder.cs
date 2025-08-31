using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Seeding.Builders;

internal sealed class BreweryBuilder
{
    public static Brewery CreateSvijany() =>
        new ()
        {
            Name = "Svijany",
            PublicId = Guid.NewGuid(),
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
}