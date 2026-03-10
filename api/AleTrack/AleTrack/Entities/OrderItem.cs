using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;

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
    /// Amount ordered from client
    /// </summary>
    [Column("quantity")]
    public int Quantity { get; set; }
    
    /// <summary>
    /// State of the reminder for this item.
    /// </summary>
    [Column("reminder_state")]
    public OrderItemReminderState? ReminderState { get; set; }
    
    /// <summary>
    /// Flag indicating whether the loading in a related outgoing shipment is confirmed.
    /// </summary>
    [Column("is_shipment_loading_confirmed")]
    public bool IsShipmentLoadingConfirmed { get; set; }
    
    /// <summary>
    /// The parent <see cref="Order"/> related to this item.
    /// </summary>
    public Order Order { get; set; } = null!;

    /// <summary>
    /// Instance of related <see cref="Product"/> entity
    /// </summary>
    public Product Product { get; set; } = null!;
}