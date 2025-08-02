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
    /// Info about clients' official address
    /// </summary>
    public AddressDto OfficialAddress { get; set; } = null!;
    
    /// <summary>
    /// Info about clients' contact address
    /// </summary>
    public AddressDto? ContactAddress { get; set; }
}