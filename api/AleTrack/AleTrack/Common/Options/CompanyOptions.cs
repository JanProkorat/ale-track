using AleTrack.Common.Enums;

namespace AleTrack.Common.Options;

/// <summary>
/// The company's own address, bound from the <c>Company</c> configuration section.
/// </summary>
/// <remarks>
/// Single source of truth for what used to read a frontend env var: the start-point
/// picker, the coordinates of a company stop on a route, and the end of every route.
/// </remarks>
public sealed class CompanyOptions
{
    /// <summary>Configuration section this binds to.</summary>
    public const string SectionName = "Company";

    /// <summary>Display name of the company.</summary>
    public string Name { get; set; } = null!;

    /// <summary>Street the warehouse is on.</summary>
    public string StreetName { get; set; } = null!;

    /// <summary>Street number of the warehouse.</summary>
    public string StreetNumber { get; set; } = null!;

    /// <summary>City the warehouse is in.</summary>
    public string City { get; set; } = null!;

    /// <summary>Postal code of the warehouse.</summary>
    public string Zip { get; set; } = null!;

    /// <summary>Country the warehouse is in.</summary>
    public Country Country { get; set; }

    /// <summary>Latitude of the warehouse.</summary>
    public decimal Latitude { get; set; }

    /// <summary>Longitude of the warehouse.</summary>
    public decimal Longitude { get; set; }

    /// <summary>
    /// The address on one line, in the Czech postal order used everywhere in the UI.
    /// </summary>
    public string FormatAddress() => $"{StreetName} {StreetNumber}, {Zip} {City}";
}
