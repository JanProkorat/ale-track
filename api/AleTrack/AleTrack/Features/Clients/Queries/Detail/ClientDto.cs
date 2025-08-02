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
    /// Official address
    /// </summary>
    public AddressDto OfficialAddress { get; set; } = null!;
    
    /// <summary>
    /// Contact address
    /// </summary>
    public AddressDto? ContactAddress { get; set; }
}