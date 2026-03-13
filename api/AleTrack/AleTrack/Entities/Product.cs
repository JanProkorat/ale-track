using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using AleTrack.Features.Products.Utils;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Entity representing a product sold by a brewery
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
    public decimal? PriceForUnitWithVat { get; set; }
    
    /// <summary>
    /// Price for unit without VAT
    /// </summary>
    [Column("price_for_unit_without_vat")]
    public decimal? PriceForUnitWithoutVat { get; set; }
    
    /// <summary>
    /// Related Brewery
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Brewery Brewery { get; set; } = null!;
    
    /// <summary>
    /// Related <see cref="InventoryItem"/>
    /// </summary>
    public InventoryItem? InventoryItem { get; set; }
    
    /// <summary>
    /// Weight of the product in kilograms
    /// </summary>
    public double? Weight
    {
        get
        {
            if (PackageSize == null)
                return null;

            return Kind switch
            {
                ProductKind.Bottle when PackageSize == BottleSize.OneLiter => PackageWeight.OneKilo,
                ProductKind.Bottle when PackageSize == BottleSize.TwoLiters => PackageWeight.TwoKilos,
                ProductKind.Bottle when PackageSize == BottleSize.TenLiters => PackageWeight.TwentyKilos,
                ProductKind.Keg when PackageSize == KegSize.FiveLiters => PackageWeight.FiveKilos,
                ProductKind.Keg when PackageSize == KegSize.FifteenLiters => PackageWeight.TwentyKilos,
                ProductKind.Keg when PackageSize == KegSize.TwentyLiters => PackageWeight.TwentyKilos,
                ProductKind.Keg when PackageSize == KegSize.ThirtyLiters => PackageWeight.FortyTwoKilos,
                ProductKind.Keg when PackageSize == KegSize.FiftyLiters => PackageWeight.SixtyTwoKilos,
                ProductKind.Can when PackageSize == CanSize.ZeroPointThreeThreeLiters => PackageWeight.ZeroPointThree,
                ProductKind.Can when PackageSize == CanSize.ZeroPointFiveLiters => PackageWeight.ZeroPointFive,
                ProductKind.Can when PackageSize == CanSize.TwoLiters => PackageWeight.TwoKilos,
                _ => null
            };
        }
    }
    
    /// <summary>
    /// Display order based on the Product kind
    /// </summary>
    public int DisplayOrder {
        get
        {
            return Kind switch
            {
                ProductKind.Keg => 1,
                ProductKind.Bottle => 2,
                ProductKind.Can => 3,
                ProductKind.Multipack => 4,
                ProductKind.Other => 5,
                _ => 6
            };
        }
    }
}