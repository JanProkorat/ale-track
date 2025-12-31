using AleTrack.Common.Models;
using AleTrack.Entities;

namespace AleTrack.Common.Utils;

/// <summary>
/// Extensions for the <see cref="Address" entity/>
/// </summary>
public static class AddressExtensions
{
    /// <summary>
    /// Maps dto into a database entity
    /// </summary>
    /// <param name="dto"></param>
    /// <returns></returns>
    public static Address ToDbEntity(this AddressDto dto)
        => new Address
            {
                StreetName = dto.StreetName,
                StreetNumber = dto.StreetNumber,
                City = dto.City,
                Country = dto.Country,
                Zip = dto.Zip,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude
            };

    /// <summary>
    /// Maps a database entity to dto
    /// </summary>
    /// <param name="address"></param>
    /// <returns></returns>
    public static AddressDto ToDto(this Address address)
        => new AddressDto
            {
                StreetName = address.StreetName,
                StreetNumber = address.StreetNumber,
                City = address.City,
                Country = address.Country,
                Zip = address.Zip,
                Latitude = address.Latitude,
                Longitude = address.Longitude
            };
}