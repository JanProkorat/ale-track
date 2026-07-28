using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// One line of what a stop actually carried, snapshotted when the run was loaded.
/// </summary>
/// <remarks>
/// The run owns these rows. <see cref="OrderItemId"/> and <see cref="ProductId"/> are provenance
/// only — both are <c>SET NULL</c>, so retiring a product or unlinking an order costs the trail
/// but never the history.
///
/// The weight is deliberately not stored. <see cref="Kind"/>, <see cref="PackageSize"/> and
/// <see cref="UnitsPerPackage"/> are the inputs to <c>ProductWeightCalculator</c>, which stays
/// live: a formula correction (FiveKilos returning 2 instead of 5, the missing bottle-crate
/// weights) fixes a computation that was always wrong and should propagate, while a data
/// correction (a package size fixed from 10 l to 0.5 l) must not rewrite what was delivered.
/// Storing a computed weight would freeze both.
/// </remarks>
[Table("outgoing_shipment_stop_items")]
public sealed class OutgoingShipmentStopItem : PublicEntity
{
    /// <summary>
    /// ID of the owning <see cref="OutgoingShipmentStop"/>.
    /// </summary>
    [Column("stop_id")]
    public long StopId { get; set; }

    /// <summary>
    /// The <see cref="Entities.OrderItem"/> this line was snapshotted from. Provenance only.
    /// </summary>
    [Column("order_item_id")]
    public long? OrderItemId { get; set; }

    /// <summary>
    /// The <see cref="Entities.Product"/> this line was snapshotted from. Provenance only.
    /// </summary>
    [Column("product_id")]
    public long? ProductId { get; set; }

    /// <summary>Product name as it was when the run was loaded.</summary>
    [MaxLength(50)]
    [Column("product_name")]
    public string ProductName { get; set; } = null!;

    /// <summary>Product kind as it was when the run was loaded. Weight input.</summary>
    [Column("kind")]
    public ProductKind Kind { get; set; }

    /// <summary>Product type as it was when the run was loaded. Report grouping.</summary>
    [Column("type")]
    public ProductType Type { get; set; }

    /// <summary>
    /// Container volume in litres as it was when the run was loaded. Weight input.
    /// </summary>
    [Column("package_size")]
    public double? PackageSize { get; set; }

    /// <summary>
    /// Containers per sellable unit as it was when the run was loaded. Weight input.
    /// </summary>
    [Column("units_per_package")]
    public int UnitsPerPackage { get; set; } = 1;

    /// <summary>Pieces carried.</summary>
    [Column("quantity")]
    public int Quantity { get; set; }

    /// <summary>Unit price with VAT as it was when the run was loaded.</summary>
    [Column("unit_price_with_vat")]
    public decimal UnitPriceWithVat { get; set; }

    /// <summary>Unit price without VAT as it was when the run was loaded.</summary>
    [Column("unit_price_without_vat")]
    public decimal? UnitPriceWithoutVat { get; set; }

    /// <summary>
    /// Public ID of the brewery that supplied the line. Snapshotted rather than joined so the
    /// report grouping survives the brewery row going away.
    /// </summary>
    [Column("brewery_public_id")]
    public Guid BreweryPublicId { get; set; }

    /// <summary>Brewery name as it was when the run was loaded.</summary>
    [MaxLength(50)]
    [Column("brewery_name")]
    public string BreweryName { get; set; } = null!;

    /// <summary>The owning stop.</summary>
    public OutgoingShipmentStop Stop { get; set; } = null!;

    /// <summary>Provenance link to the order line. Null once that line is gone.</summary>
    [DeleteBehavior(DeleteBehavior.SetNull)]
    public OrderItem? OrderItem { get; set; }

    /// <summary>Provenance link to the product. Null once it is hard-deleted.</summary>
    [DeleteBehavior(DeleteBehavior.SetNull)]
    public Product? Product { get; set; }
}
