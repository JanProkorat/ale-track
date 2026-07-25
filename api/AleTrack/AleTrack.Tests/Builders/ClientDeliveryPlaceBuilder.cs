using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.ClientDeliveryPlaces.Commands;

namespace AleTrack.Tests.Builders;

public static class ClientDeliveryPlaceBuilder
{
    public static ClientDeliveryPlace BuildEntity(
        Guid? publicId = null,
        Client? client = null,
        string? name = null,
        string? note = null,
        Address? address = null,
        bool isDeleted = false)
    {
        var place = new ClientDeliveryPlace
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Name = name ?? "Letní zahrádka",
            Note = note,
            Address = address ?? AddressBuilder.BuildEntity(),
            IsDeleted = isDeleted
        };

        if (client is not null)
        {
            place.Client = client;
            client.DeliveryPlaces.Add(place);
        }

        return place;
    }

    public static SaveClientDeliveryPlaceDto BuildSaveDto(
        string? name = null,
        string? note = null,
        AddressDto? address = null,
        decimal? latitude = 50.897m,
        decimal? longitude = 14.807m,
        Country? country = Country.Czechia)
    {
        return new SaveClientDeliveryPlaceDto
        {
            Name = name ?? "Letní zahrádka",
            Note = note,
            Address = address ?? AddressBuilder.BuildDto(),
            Latitude = latitude,
            Longitude = longitude,
            Country = country
        };
    }
}
