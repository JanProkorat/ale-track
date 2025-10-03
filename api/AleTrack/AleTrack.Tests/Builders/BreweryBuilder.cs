using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.Breweries.Commands.Create;
using AleTrack.Features.Breweries.Commands.Update;

namespace AleTrack.Tests.Builders;

public static class BreweryBuilder
{
    public static Brewery BuildEntity(
        Guid? publicId = null,
        string? name = null,
        string? color = null,
        Address? officialAddress = null,
        Address? contactAddress = null,
        int displayOrder = 1)
    {
        return new Brewery
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Name = name ?? "Default Brewery",
            Color = color ?? "#000000",
            OfficialAddress = officialAddress ?? AddressBuilder.BuildEntity(),
            ContactAddress = contactAddress,
            DisplayOrder = displayOrder
        };
    }

    public static CreateBreweryDto BuildCreateDto(
        string? name = null,
        string? color = null,
        AddressDto? officialAddress = null,
        AddressDto? contactAddress = null)
    {
        return new CreateBreweryDto
        {
            Name = name ?? "Default Brewery",
            Color = color ?? "#000000",
            OfficialAddress = officialAddress ?? AddressBuilder.BuildDto(),
            ContactAddress = contactAddress
        };
    }

    public static UpdateBreweryDto BuildUpdateDto(
        string? name = null,
        string? color = null,
        AddressDto? officialAddress = null,
        AddressDto? contactAddress = null)
    {
        return new UpdateBreweryDto
        {
            Name = name ?? "Updated Brewery",
            Color = color ?? "#FFFFFF",
            OfficialAddress = officialAddress ?? AddressBuilder.BuildDto(
                city: "Updated City",
                streetName: "Updated Street",
                streetNumber: "2",
                zip: "11111"
            ),
            ContactAddress = contactAddress
        };
    }
}
