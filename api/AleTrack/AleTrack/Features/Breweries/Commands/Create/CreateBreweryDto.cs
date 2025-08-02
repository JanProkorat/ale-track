using AleTrack.Common.Models;

namespace AleTrack.Features.Breweries.Commands.Create;

/// <summary>
/// Represents the data transfer object used to create a new brewery.
/// </summary>
public sealed class CreateBreweryDto
{
    /// <summary>
    /// Name of the brewery
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