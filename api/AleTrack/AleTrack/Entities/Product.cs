using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Entity representing product sold by a brewery
/// </summary>
[Table("products")]
public sealed class Product : PublicEntity
{
    /// <summary>
    /// ID of related <see cref="Brewery"/>
    /// </summary>
    [Column("brewery_id")]
    public long BreweryId { get; set; }
    
    /// <summary>
    /// Name of the product
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("name")]
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Note to the product
    /// </summary>
    [MaxLength(200)]
    [Column("description")]
    public string? Description { get; set; }
    
    /// <summary>
    /// Kind of the product
    /// </summary>
    [Column("kind")]
    public ProductKind Kind { get; set; }
    
    /// <summary>
    /// Type of the product
    /// </summary>
    [Column("type")]
    public ProductType Type { get; set; }
    
    /// <summary>
    /// How much alcohol product contains
    /// </summary>
    [Column("alcohol_percentage")]
    public float? AlcoholPercentage { get; set; }
    
    /// <summary>
    /// Degree of the beer - 10, 11, 12 etc.
    /// </summary>
    [Column("plato_degree")]
    public float? PlatoDegree { get; set; }
    
    /// <summary>
    /// Size of the whole package
    /// </summary>
    [Column("package_size")]
    public double? PackageSize { get; set; }
    
    /// <summary>
    /// Price with VAT
    /// </summary>
    [Column("price_with_vat")]
    public decimal PriceWithVat { get; set; }
    
    /// <summary>
    /// Price without VAT
    /// </summary>
    [Column("price_without_vat")]
    public decimal? PriceWithoutVat { get; set; }

    /// <summary>
    /// Price for unit with VAT
    /// </summary>
    [Column("price_for_unit_with_vat")]
    public decimal PriceForUnitWithVat { get; set; }
    
    /// <summary>
    /// Price for unit without VAT
    /// </summary>
    [Column("price_for_unit_without_vat")]
    public decimal PriceForUnitWithoutVat { get; set; }
    
    /// <summary>
    /// Related Brewery
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Brewery Brewery { get; set; } = null!;
}