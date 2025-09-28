using AleTrack.Common.Enums;
using AleTrack.Common.Models;

namespace AleTrack.Features.Clients.Commands.Create;

/// <summary>
/// Represents the data used to create a new client.
/// </summary>
public sealed record CreateClientDto
{
    /// <summary>
    /// Name of the client
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Business name of the client. Can be null.
    /// </summary>
    public string? BusinessName { get; set; }

    /// <summary>
    /// Region of the client.
    /// </summary>
    public Region Region { get; set; }
    
    /// <summary>
    /// Info about clients' official address
    /// </summary>
    public AddressDto OfficialAddress { get; set; } = null!;
    
    /// <summary>
    /// Info about clients' contact address
    /// </summary>
    public AddressDto? ContactAddress { get; set; }
    
    /// <summary>
    /// List of contacts associated with the client.
    /// </summary>
    public List<CreateClientContactDto> Contacts { get; set; } = [];
}

public record CreateClientContactDto
{
    /// <summary>
    /// Gets or sets the type of contact, which indicates the category or nature
    /// of the contact such as Email or Phone.
    /// </summary>
    public ContactType Type { get; set; }

    /// <summary>
    /// Description of the contact, such as "Work" or "Home"
    /// </summary>
    public string? Description { get; set; }
    
    /// <summary>
    /// Gets or sets the value associated with the contact, such as an email address
    /// or phone number, depending on the contact type.
    /// </summary>
    public string Value { get; set; } = null!;
}