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
    /// Info about brewery address
    /// </summary>
    public AddressDto Address { get; set; } = null!;
}