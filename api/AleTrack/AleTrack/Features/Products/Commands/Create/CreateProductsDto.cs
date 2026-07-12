using AleTrack.Common.Enums;

namespace AleTrack.Features.Products.Commands.Create;

/// <summary>
/// Represents the data transfer object for creating multiple products.
/// </summary>
public sealed record CreateProductsDto
{
    /// <summary>
    /// List of products to be added
    /// </summary>
    public List<CreateProductDto> Products { get; set; } = [];
}

/// <summary>
/// Represents the data transfer object for creating a product.
/// </summary>
public sealed record CreateProductDto
{
    /// <summary>
    /// Name of the product
    /// </summary>
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Description of the product
    /// </summary>
    public string? Description { get; set; }
    
    /// <summary>
    /// Kind of the product
    /// </summary>
    public ProductKind Kind { get; set; }
    
    /// <summary>
    /// Type of the product
    /// </summary>
    public ProductType Type { get; set; }
    
    /// <summary>
    /// How much alcohol product contains
    /// </summary>
    public float? AlcoholPercentage { get; set; }
    
    /// <summary>
    /// Degree of the beer - 10, 11, 12 etc.
    /// </summary>
    public float? PlatoDegree { get; set; }
    
    /// <summary>
    /// Size of the whole package
    /// </summary>
    public double? PackageSize { get; set; }
    
    /// <summary>
    /// Price per one unit
    /// </summary>
    public decimal PriceWithVat { get; set; }
    
    /// <summary>
    /// Price for unit with VAT
    /// </summary>
    public decimal PriceForUnitWithVat { get; set; }
    
    /// <summary>
    /// Price for unit without VAT
    /// </summary>
    public decimal PriceForUnitWithoutVat { get; set; }
}