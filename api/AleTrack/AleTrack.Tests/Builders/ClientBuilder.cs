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
        Address? contactAddress = null,
        bool noOfficialAddress = false,
        long? invoicingClientId = null,
        Client? invoicingClient = null)
    {
        return new Client
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Name = name ?? "Default Client",
            BusinessName = businessName,
            Region = region,
            // An explicit flag rather than "null means none": every existing caller relies on
            // null defaulting to a built address.
            OfficialAddress = noOfficialAddress ? null : officialAddress ?? AddressBuilder.BuildEntity(),
            ContactAddress = contactAddress,
            InvoicingClientId = invoicingClientId,
            InvoicingClient = invoicingClient
        };
    }

    public static CreateClientDto BuildCreateDto(
        string? name = null,
        string? businessName = null,
        Region region = Region.ZittauCity,
        AddressDto? officialAddress = null,
        AddressDto? contactAddress = null,
        List<CreateClientContactDto>? contacts = null,
        bool noOfficialAddress = false,
        Guid? invoicingClientId = null)
    {
        return new CreateClientDto
        {
            Name = name ?? "Default Client",
            BusinessName = businessName,
            Region = region,
            OfficialAddress = noOfficialAddress ? null : officialAddress ?? AddressBuilder.BuildDto(),
            ContactAddress = contactAddress,
            InvoicingClientId = invoicingClientId,
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
        List<UpdateClientContactDto>? contacts = null,
        bool noOfficialAddress = false,
        Guid? invoicingClientId = null)
    {
        return new UpdateClientDto
        {
            Name = name ?? "Updated Client",
            BusinessName = businessName ?? "Updated Business",
            Region = region,
            OfficialAddress = noOfficialAddress
                ? null
                : officialAddress ?? AddressBuilder.BuildDto(
                    city: "Updated City",
                    streetName: "Updated Street",
                    streetNumber: "2",
                    zip: "11111"
                ),
            ContactAddress = contactAddress,
            InvoicingClientId = invoicingClientId,
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
