using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.Clients.Commands.Create;
using AleTrack.Features.Clients.Commands.Update;

namespace AleTrack.Tests.Builders;

public static class ClientBuilder
{
    public static Client BuildEntity(
        Guid? publicId = null,
        string? name = null,
        string? businessName = null,
        Region region = Region.ZittauCity,
        Address? officialAddress = null,
        Address? contactAddress = null)
    {
        return new Client
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Name = name ?? "Default Client",
            BusinessName = businessName,
            Region = region,
            OfficialAddress = officialAddress ?? AddressBuilder.BuildEntity(),
            ContactAddress = contactAddress
        };
    }

    public static CreateClientDto BuildCreateDto(
        string? name = null,
        string? businessName = null,
        Region region = Region.ZittauCity,
        AddressDto? officialAddress = null,
        AddressDto? contactAddress = null,
        List<CreateClientContactDto>? contacts = null)
    {
        return new CreateClientDto
        {
            Name = name ?? "Default Client",
            BusinessName = businessName,
            Region = region,
            OfficialAddress = officialAddress ?? AddressBuilder.BuildDto(),
            ContactAddress = contactAddress,
            Contacts = contacts ??
            [
                new CreateClientContactDto
                {
                    Type = ContactType.Email,
                    Description = "Primary",
                    Value = "test@example.com"
                }
            ]
        };
    }

    public static UpdateClientDto BuildUpdateDto(
        string? name = null,
        string? businessName = null,
        Region region = Region.Berlin,
        AddressDto? officialAddress = null,
        AddressDto? contactAddress = null,
        List<UpdateClientContactDto>? contacts = null)
    {
        return new UpdateClientDto
        {
            Name = name ?? "Updated Client",
            BusinessName = businessName ?? "Updated Business",
            Region = region,
            OfficialAddress = officialAddress ?? AddressBuilder.BuildDto(
                city: "Updated City",
                streetName: "Updated Street",
                streetNumber: "2",
                zip: "11111"
            ),
            ContactAddress = contactAddress,
            Contacts = contacts ??
            [
                new UpdateClientContactDto
                {
                    Type = ContactType.Phone,
                    Description = "Updated",
                    Value = "+420123456789"
                }
            ]
        };
    }
}
