using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a specific item within an order.
/// </summary>
/// <remarks>
/// This entity is associated with a product and belongs to a specific order.
/// Each item includes a quantity (Amount) as well as references to the related
/// order and product.
/// </remarks>
[Table("order_items")]
public sealed class OrderItem : PublicEntity
{
    /// <summary>
    /// ID of related <see cref="Order"/>
    /// </summary>
    [Column("order_id")]
    public long OrderId { get; set; }

    /// <summary>
    /// ID of related <see cref="Product"/>
    /// </summary>
    [Column("product_id")]
    public long ProductId { get; set; }
    
    /// <summary>
    /// Amount ordered from a client
    /// </summary>
    [Column("quantity")]
    public int Quantity { get; set; }
    
    /// <summary>
    /// Whether this line is for the goods, the money, or both — see <see cref="OrderLineKind"/>.
    /// </summary>
    /// <remarks>
    /// Part of the frozen content: it decides what the run loads and what the invoice bills, so
    /// it is snapshotted with the quantity rather than merged separately like the note.
    /// </remarks>
    [Column("line_kind")]
    public OrderLineKind LineKind { get; set; } = OrderLineKind.Normal;

    /// <summary>
    /// State of the reminder for this item.
    /// </summary>
    [Column("reminder_state")]
    public OrderItemReminderState? ReminderState { get; set; }

    /// <summary>
    /// Optional free-form note about this line — an instruction for whoever loads or
    /// delivers it ("nechat u zadního vchodu").
    /// </summary>
    /// <remarks>
    /// Not part of the frozen content: unlike <see cref="Quantity"/> it does not describe
    /// what is on the truck, only what to do with it, and it is most useful precisely once
    /// the shipment is already packed. So it is written by its own merge step rather than
    /// by the item rebuild in <c>UpdateOrderEndpoint</c>, and stays editable at every state.
    /// </remarks>
    [MaxLength(500)]
    [Column("note")]
    public string? Note { get; set; }


    /// <summary>
    /// Flag indicating whether the loading in a related outgoing shipment is confirmed.
    /// </summary>
    [Column("is_shipment_loading_confirmed")]
    public bool IsShipmentLoadingConfirmed { get; set; }

    /// <summary>
    /// How many of this item's pieces are taken from our own inventory rather than
    /// supplied by the brewery. The client still ordered — and is billed for —
    /// <see cref="Quantity"/>; this only records where the goods came from.
    /// </summary>
    /// <remarks>
    /// Like <see cref="IsShipmentLoadingConfirmed"/>, this describes the loading the
    /// order currently sits on, and is cleared when the order is freed for another
    /// shipment. Never greater than <see cref="Quantity"/>.
    /// </remarks>
    [Column("quantity_from_inventory")]
    public int QuantityFromInventory { get; set; }

    /// <summary>
    /// ID of the stock entry the inventory-sourced pieces come from. Null when none are.
    /// </summary>
    [Column("inventory_item_id")]
    public long? InventoryItemId { get; set; }

    /// <summary>
    /// Stock entry the inventory-sourced pieces come from.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public InventoryItem? InventoryItem { get; set; }
    
    /// <summary>
    /// The parent <see cref="Order"/> related to this item.
    /// </summary>
    public Order Order { get; set; } = null!;

    /// <summary>
    /// Instance of related <see cref="Product"/> entity
    /// </summary>
    /// <remarks>
    /// Restrict, not the EF default Cascade: deleting a product used to cascade into
    /// order_items and on into outgoing_shipment_invoice_lines, wiping the history of
    /// everything ever sold. The incoming side (delivery_items.product_id) was already
    /// Restrict, which is what showed the cascade had never been a deliberate choice.
    /// </remarks>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Product Product { get; set; } = null!;
}