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
    /// Info about clients address
    /// </summary>
    public AddressDto Address { get; set; } = null!;
}