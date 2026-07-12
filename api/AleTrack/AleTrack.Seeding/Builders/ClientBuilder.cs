using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Seeding.Builders;

internal static class ClientBuilder
{
    public static List<Client> GetSampleClients()
    {
        return
        [
            new Client
            {
                PublicId = Guid.Parse("8b83006e-c441-4e80-86fd-8d2cf1306583"),
                Name = "Klient 12",
                BusinessName = "test",
                Region = Region.Goerlitz,
                OfficialAddress = new Address
                {
                    StreetName = "Scultetusstraße",
                    StreetNumber = "28",
                    City = "Gorlitz",
                    Zip = "02828",
                    Country = Country.Germany,
                    Latitude = 51.1646459m,
                    Longitude = 14.9788199m
                },
                ContactAddress = new Address
                {
                    StreetName = "Postpl",
                    StreetNumber = "1",
                    City = "Gorlitz",
                    Zip = "02826",
                    Country = Country.Germany,
                    Latitude = 51.151713m,
                    Longitude = 14.9869437m
                }
            },

            new Client
            {
                PublicId = Guid.Parse("9d631443-746f-44b0-bfdf-c1e7aa91347e"),
                Name = "Zitavsky klient",
                BusinessName = "",
                Region = Region.ZittauCity,
                OfficialAddress = new Address
                {
                    StreetName = "Markt",
                    StreetNumber = "1",
                    City = "Zittau",
                    Zip = "98721",
                    Country = Country.Germany,
                    Latitude = 50.8959765m,
                    Longitude = 14.8079241m
                }
            },

            new Client
            {
                PublicId = Guid.Parse("4fde9467-c4b9-4fe0-89ef-66cd6e8a2521"),
                Name = "Anke Kirstein",
                BusinessName = "Kubis Bier und Saftladen",
                Region = Region.ZittauRegion,
                OfficialAddress = new Address
                {
                    StreetName = "Bertsdorfer str..",
                    StreetNumber = "5",
                    City = "Bertsdorf-Hörnitz",
                    Zip = "02763",
                    Country = Country.Germany,
                    Latitude = 50.8990193m,
                    Longitude = 14.7578828m
                }
            },

            new Client
            {
                PublicId = Guid.Parse("a67137a6-31ca-4c81-a985-865296677c24"),
                Name = "Jens Jürgen Goth",
                BusinessName = "Hotel haus Hubertus",
                Region = Region.ZittauRegion,
                OfficialAddress = new Address
                {
                    StreetName = "Hubertusweg",
                    StreetNumber = "10",
                    City = "Oybin",
                    Zip = "02797",
                    Country = Country.Germany,
                    Latitude = 50.838103m,
                    Longitude = 14.7305168m
                }
            },

            new Client
            {
                PublicId = Guid.Parse("8d564aec-9cd4-4dff-9c2e-424b1ecc5316"),
                Name = "Lutz Kellotat",
                BusinessName = "Schwarzer Bär (Černý Medvěd)",
                Region = Region.ZittauCity,
                OfficialAddress = new Address
                {
                    StreetName = "Ottokarplatz",
                    StreetNumber = "12",
                    City = "Zittau",
                    Zip = "02763",
                    Country = Country.Germany,
                    Latitude = 50.8930403m,
                    Longitude = 14.8104683m
                }
            },

            new Client
            {
                PublicId = Guid.Parse("a0ac49e2-7c27-4128-80d1-954b15597087"),
                Name = "Daniel Böhm",
                BusinessName = "B4 Bowling",
                Region = Region.ZittauCity,
                OfficialAddress = new Address
                {
                    StreetName = "Rathenaustraße",
                    StreetNumber = "15",
                    City = "Zittau",
                    Zip = "02763",
                    Country = Country.Germany,
                    Latitude = 50.9004399m,
                    Longitude = 14.7976739m
                }
            },

            new Client
            {
                PublicId = Guid.Parse("d145589d-b6a9-4753-bfea-507be48c9bbf"),
                Name = "Maik Bollmann",
                BusinessName = "Wirtshaus zor Weinau",
                Region = Region.ZittauCity,
                OfficialAddress = new Address
                {
                    StreetName = "Weinaupark",
                    StreetNumber = "3",
                    City = "Zittau",
                    Zip = "02763",
                    Country = Country.Germany,
                    Latitude = 50.9011059m,
                    Longitude = 14.8334278m
                }
            },

            new Client
            {
                PublicId = Guid.Parse("20697e41-35ab-42d2-a830-6ec8c84e14d4"),
                Name = "Jens Erxleben",
                BusinessName = "Restaurant Kegelbahn",
                Region = Region.ZittauCity,
                OfficialAddress = new Address
                {
                    StreetName = "Kummersberg",
                    StreetNumber = "13",
                    City = "Zittau",
                    Zip = "02763",
                    Country = Country.Germany,
                    Latitude = 50.901905m,
                    Longitude = 14.7890296m
                }
            }
        ];
    }
}