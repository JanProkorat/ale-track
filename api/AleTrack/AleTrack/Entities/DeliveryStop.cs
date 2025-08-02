using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a delivery stop in a delivery transaction - typically a brewery
/// </summary>
[Table("delivery_stops")]
public sealed class DeliveryStop : PublicEntity
{
    /// <summary>
    /// ID of the related delivery
    /// </summary>
    [Column("delivery_id")]
    public long DeliveryId { get; set; }

    /// <summary>
    /// ID of related <see cref="Brewery"/> where drivers will go for the products
    /// </summary>
    [Column("brewery_id")]
    public long BreweryId { get; set; }
    
    /// <summary>
    /// Description of the product to be delivered
    /// </summary>
    [MaxLength(200)]
    [Column("note")]
    public string? Note { get; set; }
    
    /// <summary>
    /// List of item brought by the delivery from the brewery
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public List<DeliveryItem> Items { get; set; } = [];
    
    /// <summary>
    /// Related <see cref="Brewery"/>
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Brewery Brewery { get; set; } = null!;
    
    /// <summary>
    /// Related delivery
    /// </summary>
    public ProductDelivery Delivery { get; set; } = null!;
}