using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Entity representing action when driver goes to <see cref="Brewery"/> and delivers <see cref="Product"/> to be stored in the inventory
/// </summary>
[Table("product_deliveries")]
public sealed class ProductDelivery : PublicEntity
{
    /// <summary>
    /// Date when drivers will go to brewery for products to fill the inventory
    /// </summary>
    [Column("date")]
    public DateTime Date { get; set; }
    
    /// <summary>
    /// ID of related vehicle
    /// </summary>
    [Column("vehicle_id")]
    public long? VehicleId { get; set; }
    
    /// <summary>
    /// Progress of the delivery
    /// </summary>
    [Column("state")]
    public ProductDeliveryState State { get; set; }
    
    /// <summary>
    /// ID of related <see cref="Brewery"/> where drivers will go for the products
    /// </summary>
    [Column("brewery_id")]
    public long BreweryId { get; set; }

    /// <summary>
    /// Note to the delivery
    /// </summary>
    [MaxLength(200)]
    [Column("note")]
    public string? Note { get; set; }
    
    /// <summary>
    /// Related <see cref="Brewery"/>
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Brewery Brewery { get; set; } = null!;
    
    /// <summary>
    /// Related <see cref="Vehicle"/>
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Vehicle? Vehicle { get; set; }
    
    /// <summary>
    /// List of drivers doing the delivery
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public ICollection<Driver> Drivers { get; set; } = [];
    
    /// <summary>
    /// List of item brought by the delivery from the brewery
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<DeliveryItem> Items { get; set; } = [];
}