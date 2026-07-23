using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a delivery stop in a delivery transaction - a brewery to collect
/// products from, or a custom free-form waypoint on the route.
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
    /// Position of this stop on the route (0-based).
    /// </summary>
    [Column("order")]
    public int Order { get; set; }

    /// <summary>
    /// Whether this stop is a brewery or a custom waypoint.
    /// </summary>
    [Column("kind")]
    public DeliveryStopKind Kind { get; set; }

    /// <summary>
    /// ID of related <see cref="Brewery"/> where drivers will go for the products.
    /// Null for custom stops.
    /// </summary>
    [Column("brewery_id")]
    public long? BreweryId { get; set; }

    /// <summary>
    /// Display name of a custom stop. Null for brewery stops.
    /// </summary>
    [MaxLength(100)]
    [Column("label")]
    public string? Label { get; set; }

    /// <summary>
    /// Description of the product to be delivered
    /// </summary>
    [MaxLength(200)]
    [Column("note")]
    public string? Note { get; set; }

    /// <summary>
    /// Latitude of a custom stop. Null for brewery stops (they use the brewery's).
    /// </summary>
    [Column("latitude")]
    public decimal? Latitude { get; set; }

    /// <summary>
    /// Longitude of a custom stop. Null for brewery stops.
    /// </summary>
    [Column("longitude")]
    public decimal? Longitude { get; set; }

    /// <summary>
    /// List of item brought by the delivery from the brewery
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public List<DeliveryItem> Items { get; set; } = [];

    /// <summary>
    /// Related <see cref="Brewery"/>. Null for custom stops.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Brewery? Brewery { get; set; }

    /// <summary>
    /// Related delivery
    /// </summary>
    public ProductDelivery Delivery { get; set; } = null!;
}
