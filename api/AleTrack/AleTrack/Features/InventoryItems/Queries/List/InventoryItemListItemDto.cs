using AleTrack.Common.Enums;

namespace AleTrack.Features.InventoryItems.Queries.List;

/// <summary>
/// Represents a data transfer object for an inventory item, commonly used to encapsulate
/// detail information retrieved from the database and sent as part of a response.
/// </summary>
public sealed record InventoryItemListItemDto
{
    /// <summary>
    /// Public ID of the inventory idem
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Name of the inventory item
    /// </summary>
    public string? Name { get; set; }
    
    /// <summary>
    /// Public ID of related product
    /// </summary>
    public Guid? ProductId { get; set; }
    
    /// <summary>
    /// Amount of products currently in inventory
    /// </summary>
    public int Quantity { get; set; }
    
    /// <summary>
    /// Kind of the product associated with the inventory item
    /// </summary>
    public ProductKind? Kind { get; set; }
    
    /// <summary>
    /// Type of the product
    /// </summary>
    public ProductType? Type { get; set; }
    
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
    public decimal? PriceWithVat { get; set; }
    
    /// <summary>
    /// Price for unit with VAT
    /// </summary>
    public decimal? PriceForUnitWithVat { get; set; }
    
    /// <summary>
    /// Price for unit without VAT
    /// </summary>
    public decimal? PriceForUnitWithoutVat { get; set; }
}