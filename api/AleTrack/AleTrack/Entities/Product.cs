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
public sealed class Product : PublicSoftlyDeletableEntity
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
    /// Kind of the product. Derived from <see cref="Container"/> and <see cref="SaleUnit"/> on every
    /// write via <see cref="ProductPackaging.DeriveKind"/> — never set directly by a caller.
    /// </summary>
    /// <remarks>
    /// Still a real column rather than a computed property because the reporting projections select
    /// it inside EF queries (see <c>DeliveredLineQuery</c>), and EF cannot translate an unmapped
    /// property to SQL. It is a denormalisation of the packaging pair, kept for those queries.
    /// </remarks>
    [Column("kind")]
    public ProductKind Kind { get; set; }

    /// <summary>
    /// The vessel the drink is in.
    /// </summary>
    [Column("container")]
    public ProductContainer Container { get; set; } = ProductContainer.Other;

    /// <summary>
    /// What one sellable unit of this product is.
    /// </summary>
    [Column("sale_unit")]
    public ProductSaleUnit SaleUnit { get; set; } = ProductSaleUnit.Single;

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
    /// Volume of a single container inside the package, in litres — the bottle, can or keg, not
    /// the package total. Combine with <see cref="UnitsPerPackage"/> for the package as a whole.
    /// </summary>
    [Column("package_size")]
    public double? PackageSize { get; set; }

    /// <summary>
    /// How many individual containers make up one sellable unit: 20 for a 0.5 l crate, 24 for a
    /// 0.33 l crate, 8 for an eight-pack, 1 for a keg or a single bottle.
    /// </summary>
    /// <remarks>
    /// Recorded, never inferred. It used to be derived from the product name and a hardcoded crate
    /// table, which could not express that a can tray is 24 at 0.5 l but 12 at 0.33 l.
    /// </remarks>
    [Column("units_per_package")]
    public int UnitsPerPackage { get; set; } = 1;
    
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
    /// Date the price list that set this product's prices takes effect, when they came from one.
    /// </summary>
    /// <remarks>
    /// Provenance for a single row, alongside the <see cref="PriceListImport"/> that records the
    /// whole import: it answers "which list says this price" without joining anything.
    /// </remarks>
    [Column("price_effective_from")]
    public DateOnly? PriceEffectiveFrom { get; set; }

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
    public double? Weight => ProductWeightCalculator.Compute(Container, SaleUnit, PackageSize, UnitsPerPackage);
    
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