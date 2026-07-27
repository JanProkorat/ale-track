using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Goods bought from the brewery on this run for our own warehouse — "Zboží na sklad".
/// Tied to no client order; unloaded into inventory when the shipment is delivered.
/// </summary>
/// <remarks>
/// The opposite direction of <see cref="OrderItem.QuantityFromInventory"/>, which records
/// ordered pieces taken <em>out</em> of our stock instead of off the brewery's pallet. These
/// pieces go <em>in</em>: <c>UpdateOutgoingShipmentEndpoint</c> adds them to inventory on the
/// transition to Delivered.
///
/// Called "InventoryExtraItem" until 2026-07-25, when the frontend was found to be treating it
/// as a withdrawal from stock — it offered only products already in stock and capped quantities
/// at stock on hand, the opposite of what the backend has always done with it.
/// </remarks>
[Table("outgoing_shipment_stock_purchase_items")]
public sealed class OutgoingShipmentStockPurchaseItem : PublicEntity
{
    /// <summary>
    /// ID of the outgoing shipment
    /// </summary>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// ID of the product
    /// </summary>
    [Column("product_id")]
    public long ProductId { get; set; }

    /// <summary>
    /// Quantity bought from the brewery for our warehouse
    /// </summary>
    [Column("quantity")]
    public int Quantity { get; set; }

    /// <summary>
    /// Flag indicating whether the loading in a related outgoing shipment is confirmed.
    /// </summary>
    [Column("is_shipment_loading_confirmed")]
    public bool IsShipmentLoadingConfirmed { get; set; }

    /// <summary>
    /// Outgoing shipment associated with this item
    /// </summary>
    public OutgoingShipment OutgoingShipment { get; set; } = null!;

    /// <summary>
    /// Product associated with this item
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public Product Product { get; set; } = null!;
}
