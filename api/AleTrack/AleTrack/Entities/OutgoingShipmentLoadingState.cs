using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// How far one product has got through loading, for one brewery-invoice column of a shipment.
/// </summary>
/// <remarks>
/// Keyed by product and column rather than by order item, because that is the granularity the
/// nakládka is worked at: one line per product, and the pieces of a product can sit on more than
/// one brewery invoice, each loaded and checked separately.
///
/// Deliberately not hung off <see cref="OutgoingShipmentPurchaseInvoiceLine"/>: the first column
/// is the computed remainder and stores no lines, and it is also where pieces taken from our own
/// garage live — those are on no brewery invoice at all but still have to be loaded.
///
/// Only states past <see cref="ShipmentLoadingState.NotLoaded"/> are stored; going back to it
/// deletes the row.
/// </remarks>
[Table("outgoing_shipment_loading_states")]
[Index(nameof(OutgoingShipmentId), nameof(ProductId), nameof(Sequence), IsUnique = true)]
public sealed class OutgoingShipmentLoadingState : PublicEntity
{
    /// <summary>
    /// ID of the related <see cref="OutgoingShipment"/>
    /// </summary>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// ID of the <see cref="Product"/> this state is about
    /// </summary>
    [Column("product_id")]
    public long ProductId { get; set; }

    /// <summary>
    /// Which invoice column, by position within the shipment. 1 is the remainder column.
    /// </summary>
    [Column("sequence")]
    public int Sequence { get; set; }

    /// <summary>
    /// How far this product has got in this column.
    /// </summary>
    [Column("state")]
    public ShipmentLoadingState State { get; set; }

    /// <summary>
    /// Outgoing shipment this state belongs to
    /// </summary>
    public OutgoingShipment OutgoingShipment { get; set; } = null!;

    /// <summary>
    /// Product this state is about
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public Product Product { get; set; } = null!;
}
