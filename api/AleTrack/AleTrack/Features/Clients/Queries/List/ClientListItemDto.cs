using AleTrack.Common.Enums;

namespace AleTrack.Features.Clients.Queries.List;

/// <summary>
/// Represents a data transfer object for a client item in the list.
/// Contains basic information about a client.
/// </summary>
public sealed class ClientListItemDto
{
    /// <summary>
    /// Unique identifier of the client.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Name of the client.
    /// </summary>
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Name of the street
    /// </summary>
    public string StreetName { get; set; } = null!;
    
    /// <summary>
    /// Street number
    /// </summary>
    public string StreetNumber { get; set; } = null!;
    
    /// <summary>
    /// Name of the city
    /// </summary>
    public string City { get; set; } = null!;
    
    /// <summary>
    /// Zip code
    /// </summary>
    public string Zip { get; set; } = null!;
    
    /// <summary>
    /// Name of related country
    /// </summary>
    public Country Country { get; set; }
}