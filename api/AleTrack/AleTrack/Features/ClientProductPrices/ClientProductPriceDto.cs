using AleTrack.Common.Enums;

namespace AleTrack.Features.ClientProductPrices;

/// <summary>
/// One client-specific product price, with the ceník price it stands in for.
/// </summary>
public sealed record ClientProductPriceDto
{
    /// <summary>Public ID of the product</summary>
    public Guid ProductId { get; set; }

    /// <summary>Name of the product</summary>
    public string ProductName { get; set; } = null!;

    /// <summary>Kind of the product</summary>
    public ProductKind Kind { get; set; }

    /// <summary>Volume of a single container inside the package, in litres</summary>
    public double? PackageSize { get; set; }

    /// <summary>Public ID of the product's brewery</summary>
    public Guid BreweryId { get; set; }

    /// <summary>Name of the product's brewery</summary>
    public string BreweryName { get; set; } = null!;

    /// <summary>The price this client pays</summary>
    public decimal PriceWithVat { get; set; }

    /// <summary>The brewery's ceník price this stands in for</summary>
    public decimal ListPriceWithVat { get; set; }

    /// <summary>When the price was last decided</summary>
    public DateOnly SetOn { get; set; }
}
