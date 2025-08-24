using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Entity representing one item in the inventory
/// </summary>
[Table("inventory_items")]
public sealed class InventoryItem : PublicEntity
{
    /// <summary>
    /// ID of related <see cref="Product"/> - Null if no regular brewery product is related
    /// </summary>
    [Column("product_id")]
    public long? ProductId { get; set; }

    /// <summary>
    /// Name of the item - not null only if it is not related to product
    /// </summary>
    [MaxLength(50)]
    public string? Name { get; set; }
    
    /// <summary>
    /// Amount of products currently in inventory
    /// </summary>
    [Column("quantity")]
    public int Quantity { get; set; }
    
    /// <summary>
    /// Related <see cref="Product"/>
    /// </summary>
    public Product? Product { get; set; }
    
    /// <summary>
    /// Note to the item
    /// </summary>
    [MaxLength(200)]
    [Column("note")]
    public string? Note { get; set; }
}