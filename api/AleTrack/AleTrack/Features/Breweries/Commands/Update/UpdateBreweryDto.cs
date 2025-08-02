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
    /// Info about the brewery's official address
    /// </summary>
    public AddressDto OfficialAddress { get; set; } = null!;
    
    /// <summary>
    /// Info about the brewery's contact address
    /// </summary>
    public AddressDto? ContactAddress { get; set; }
}