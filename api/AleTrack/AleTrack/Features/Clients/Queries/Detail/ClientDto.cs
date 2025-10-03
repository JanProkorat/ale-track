using AleTrack.Common.Enums;
using AleTrack.Common.Models;

namespace AleTrack.Features.Clients.Queries.Detail;

/// <summary>
/// Represents a Data Transfer Object for a client, containing client-specific details.
/// </summary>
public sealed record ClientDto
{
    /// <summary>
    /// ID of the client
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Name of the client
    /// </summary>
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Name of the client's business
    /// </summary>
    public string? BusinessName { get; set; }
    
    /// <summary>
    /// Region of the client
    /// </summary>
    public Region Region { get; set; }
    
    /// <summary>
    /// Official address
    /// </summary>
    public AddressDto OfficialAddress { get; set; } = null!;
    
    /// <summary>
    /// Contact address
    /// </summary>
    public AddressDto? ContactAddress { get; set; }
    
    /// <summary>
    /// Related contacts of the client
    /// </summary>
    public List<ClientContactDto> Contacts { get; set; } = [];
}

public record ClientContactDto
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