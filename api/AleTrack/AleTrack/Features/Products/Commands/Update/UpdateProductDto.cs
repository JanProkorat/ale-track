using AleTrack.Common.Enums;

namespace AleTrack.Features.Products.Commands.Update;

/// <summary>
/// Represents the data transfer object for updating a product.
/// </summary>
public sealed record UpdateProductDto
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
    /// The vessel the drink is in.
    /// </summary>
    public ProductContainer Container { get; set; }

    /// <summary>
    /// What one sellable unit of this product is.
    /// </summary>
    public ProductSaleUnit SaleUnit { get; set; }

    /// <summary>
    /// How many containers one sellable unit holds. 1 for a keg, 20 for a 0.5 l crate, 12 for a
    /// 0.33 l can tray.
    /// </summary>
    public int UnitsPerPackage { get; set; } = 1;

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