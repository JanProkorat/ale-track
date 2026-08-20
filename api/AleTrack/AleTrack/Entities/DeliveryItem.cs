using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents the item being delivered in a delivery transaction — either a brewery
/// <see cref="Product"/> or one charge kind of a <see cref="Entities.SupplierGood"/>.
/// </summary>
/// <remarks>
/// One table with two mutually exclusive foreign keys rather than two tables, so every consumer
/// — the detail query, the editor's cart, the Operations report — walks a single
/// <see cref="DeliveryStop.Items"/> collection and keeps one ordering. Which key is set is
/// enforced by a check constraint, see <c>DeliveryItemConfiguration</c>.
/// </remarks>
[Table("delivery_items")]
public sealed class DeliveryItem : BaseEntity
{
    /// <summary>
    /// ID of related delivery
    /// </summary>
    [Column("delivery_stop_id")]
    public long DeliveryStopId { get; set; }

    /// <summary>
    /// ID of related product brought by the delivery. Set on brewery lines, null on supplier ones.
    /// </summary>
    [Column("product_id")]
    public long? ProductId { get; set; }

    /// <summary>
    /// ID of the related <see cref="Entities.SupplierGood"/> collected from a supplier.
    /// Set on supplier lines, null on brewery ones.
    /// </summary>
    [Column("supplier_good_id")]
    public long? SupplierGoodId { get; set; }

    /// <summary>
    /// Which of the good's prices this line is for. Set on supplier lines, null on brewery ones.
    /// </summary>
    /// <remarks>
    /// Part of the line's identity, not a display detail: the same bottle can be on one trip both
    /// as Plnění and as Nájem, and those are two lines at two prices. It is the charge kind that
    /// tells them apart, which is why the duplicate-line rule keys on it.
    /// </remarks>
    [Column("charge_kind")]
    public SupplierChargeKind? ChargeKind { get; set; }

    /// <summary>
    /// Amount of items to be delivered
    /// </summary>
    [Column("quantity")]
    public int Quantity { get; set; }

    /// <summary>
    /// Product kind as it was when this line was booked in. Weight input. Null on supplier lines:
    /// a good states its size as free text ("10 kg", "20 ks"), so there is no kind to record and
    /// no weight to compute.
    /// </summary>
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
    public ProductKind? Kind { get; set; }

    /// <summary>
    /// Container volume in litres as it was when this line was booked in. Weight input.
    /// Null on supplier lines.
    /// </summary>
    [Column("package_size")]
    public double? PackageSize { get; set; }

    /// <summary>
    /// Containers per sellable unit as it was when this line was booked in. Weight input.
    /// Null on supplier lines.
    /// </summary>
    [Column("units_per_package")]
    public int? UnitsPerPackage { get; set; } = 1;
    
    /// <summary>
    /// Description of the product to be delivered
    /// </summary>
    [MaxLength(200)]
    [Column("note")]
    public string? Note { get; set; }

    /// <summary>
    /// Related <see cref="Product"/>. Set only on brewery lines.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Product? Product { get; set; }

    /// <summary>
    /// Related <see cref="Entities.SupplierGood"/>. Set only on supplier lines.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public SupplierGood? SupplierGood { get; set; }

    /// <summary>
    /// Related delivery stop
    /// </summary>
    public DeliveryStop DeliveryStop { get; set; } = null!;
}