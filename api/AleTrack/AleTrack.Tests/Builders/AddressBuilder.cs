using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Entities;

namespace AleTrack.Tests.Builders;

public static class AddressBuilder
{
    public static Address BuildEntity(
        string? city = null,
        string? streetName = null,
        string? streetNumber = null,
        Country country = Country.Czechia,
        string? zip = null)
    {
        return new Address
        {
            City = city ?? "Default City",
            StreetName = streetName ?? "Default Street",
            StreetNumber = streetNumber ?? "1",
            Country = country,
            Zip = zip ?? "00000"
        };
    }

    public static AddressDto BuildDto(
        string? city = null,
        string? streetName = null,
        string? streetNumber = null,
        Country country = Country.Czechia,
        string? zip = null)
    {
        return new AddressDto
        {
            City = city ?? "Default City",
            StreetName = streetName ?? "Default Street",
            StreetNumber = streetNumber ?? "1",
            Country = country,
            Zip = zip ?? "00000"
        };
    }
}

