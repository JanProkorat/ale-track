using AleTrack.Common.Models;

namespace AleTrack.Features.Breweries.Commands.Update;

/// <summary>
/// Represents the data transfer object for updating a Brewery's details.
/// </summary>
public sealed record UpdateBreweryDto
{
    /// <summary>
    /// Name of the Brewery
    /// </summary>
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Info about brewery address
    /// </summary>
    public AddressDto Address { get; set; } = null!;
}