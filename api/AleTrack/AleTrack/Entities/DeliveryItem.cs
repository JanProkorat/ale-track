using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents the item being delivered in a delivery transaction.
/// </summary>
[Table("delivery_items")]
public sealed class DeliveryItem : BaseEntity
{
    /// <summary>
    /// ID of related delivery
    /// </summary>
    [Column("delivery_id")]
    public long DeliveryId { get; set; }
    
    /// <summary>
    /// ID of related product brought by the delivery
    /// </summary>
    [Column("product_id")]
    public long ProductId { get; set; }
    
    /// <summary>
    /// Amount of items to be delivered
    /// </summary>
    [Column("amount")]
    public int Amount { get; set; }
    
    /// <summary>
    /// Name of the product to be delivered
    /// </summary>
    [MaxLength(50)]
    [Column("name")]
    public string? Name { get; set; }
    
    /// <summary>
    /// Description of the product to be delivered
    /// </summary>
    [MaxLength(200)]
    [Column("note")]
    public string? Note { get; set; }

    /// <summary>
    /// Related <see cref="Product"/>
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Product Product { get; set; } = null!;
    
    /// <summary>
    /// Related delivery
    /// </summary>
    public ProductDelivery Delivery { get; set; } = null!;
}