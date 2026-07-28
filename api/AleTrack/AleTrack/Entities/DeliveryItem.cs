using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
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
    [Column("delivery_stop_id")]
    public long DeliveryStopId { get; set; }
    
    /// <summary>
    /// ID of related product brought by the delivery
    /// </summary>
    [Column("product_id")]
    public long ProductId { get; set; }
    
    /// <summary>
    /// Amount of items to be delivered
    /// </summary>
    [Column("quantity")]
    public int Quantity { get; set; }

    /// <summary>Product kind as it was when this line was booked in. Weight input.</summary>
    /// <remarks>
    /// The Operations report's incoming-versus-outgoing chart derives a weight from these three,
    /// and the outgoing half reads the run's snapshot. Leaving this side live would have left one
    /// series moving under a product edit while the other stayed put.
    ///
    /// As everywhere else in this work, the inputs are stored and the formula stays live, so
    /// correcting <c>ProductWeightCalculator</c> still reaches history while correcting the
    /// product data it consumes no longer does.
    /// </remarks>
    [Column("kind")]
    public ProductKind Kind { get; set; }

    /// <summary>
    /// Container volume in litres as it was when this line was booked in. Weight input.
    /// </summary>
    [Column("package_size")]
    public double? PackageSize { get; set; }

    /// <summary>
    /// Containers per sellable unit as it was when this line was booked in. Weight input.
    /// </summary>
    [Column("units_per_package")]
    public int UnitsPerPackage { get; set; } = 1;
    
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
    /// Related delivery stop
    /// </summary>
    public DeliveryStop DeliveryStop { get; set; } = null!;
}