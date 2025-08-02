using AleTrack.Common.Models;

namespace AleTrack.Features.Clients.Commands.Update;

/// <summary>
/// Represents the data transfer object for updating a client's details.
/// </summary>
public sealed record UpdateClientDto
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