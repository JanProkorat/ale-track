using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// A dokládka: stock pulled from the inventory and delivered to the client on top
/// of their order. Owned by the order, so the billed client is structural.
/// </summary>
[Table("order_client_extra_items")]
public sealed class OrderClientExtraItem : PublicEntity
{
    /// <summary>
    /// ID of related <see cref="Entities.Order"/>
    /// </summary>
    [Column("order_id")]
    public long OrderId { get; set; }

    /// <summary>
    /// ID of the inventory item this extra was taken from
    /// </summary>
    [Column("inventory_item_id")]
    public long InventoryItemId { get; set; }

    /// <summary>
    /// Quantity delivered to the client
    /// </summary>
    [Column("quantity")]
    public int Quantity { get; set; }

    /// <summary>
    /// Whether loading was confirmed on the shipment carrying this order.
    /// Owned by the shipment, not by the order editor.
    /// </summary>
    [Column("is_shipment_loading_confirmed")]
    public bool IsShipmentLoadingConfirmed { get; set; }

    /// <summary>
    /// The parent <see cref="Entities.Order"/> related to this extra item.
    /// </summary>
    public Order Order { get; set; } = null!;

    /// <summary>
    /// Inventory item this extra was taken from
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public InventoryItem InventoryItem { get; set; } = null!;
}
