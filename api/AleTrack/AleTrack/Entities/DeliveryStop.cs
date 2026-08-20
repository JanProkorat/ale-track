using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a delivery stop in a delivery transaction - a brewery to collect products from,
/// a supplier to collect goods off its price list from, or a custom free-form waypoint on
/// the route.
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
    /// Whether this stop is a brewery, a supplier or a custom waypoint.
    /// </summary>
    [Column("kind")]
    public DeliveryStopKind Kind { get; set; }

    /// <summary>
    /// ID of related <see cref="Brewery"/> where drivers will go for the products.
    /// Set only for brewery stops.
    /// </summary>
    [Column("brewery_id")]
    public long? BreweryId { get; set; }

    /// <summary>
    /// ID of related <see cref="Entities.Supplier"/> where drivers will go for the goods.
    /// Set only for supplier stops.
    /// </summary>
    /// <remarks>
    /// A sibling of <see cref="BreweryId"/> rather than one polymorphic "place" column, because
    /// the two point at tables with nothing in common: a brewery carries the colour the route map
    /// draws it in and a product catalogue, a supplier carries opening hours and a price list.
    /// The <see cref="Kind"/> discriminator says which one to read.
    /// </remarks>
    [Column("supplier_id")]
    public long? SupplierId { get; set; }

    /// <summary>
    /// Display name of a custom stop. Null for brewery and supplier stops.
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
    /// Latitude of a custom stop. Null for brewery and supplier stops — a brewery carries its
    /// own coordinates, a supplier its address's.
    /// </summary>
    [Column("latitude")]
    public decimal? Latitude { get; set; }

    /// <summary>
    /// Longitude of a custom stop. Null for brewery and supplier stops.
    /// </summary>
    [Column("longitude")]
    public decimal? Longitude { get; set; }

    /// <summary>
    /// List of items brought by the delivery from this stop — brewery products at a brewery
    /// stop, price-list goods at a supplier stop, none at a custom one.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public List<DeliveryItem> Items { get; set; } = [];

    /// <summary>
    /// Related <see cref="Brewery"/>. Set only for brewery stops.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Brewery? Brewery { get; set; }

    /// <summary>
    /// Related <see cref="Entities.Supplier"/>. Set only for supplier stops.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Supplier? Supplier { get; set; }

    /// <summary>
    /// Related delivery
    /// </summary>
    public ProductDelivery Delivery { get; set; } = null!;
}
