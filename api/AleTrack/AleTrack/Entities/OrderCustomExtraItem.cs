using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// A free-form billable item delivered to the client on top of their order.
/// </summary>
[Table("order_custom_extra_items")]
public sealed class OrderCustomExtraItem : PublicEntity
{
    /// <summary>
    /// ID of related <see cref="Entities.Order"/>
    /// </summary>
    [Column("order_id")]
    public long OrderId { get; set; }

    /// <summary>
    /// Description of the extra item
    /// </summary>
    [MaxLength(200)]
    [Column("description")]
    public string Description { get; set; } = null!;

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
}
