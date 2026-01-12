using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents an order from client.
/// An order is associated with a specific client and consists of multiple order items.
/// It tracks its current state, creation date, and the expected delivery date.
/// </summary>
[Table("orders")]
public sealed class Order : PublicEnumSoftlyDeletableEntity<OrderState>
{
    /// <summary>
    /// ID of related <see cref="Client"/>
    /// </summary>
    [Column("client_id")]
    public long ClientId { get; set; }
    
    /// <summary>
    /// Date when the order was created
    /// </summary>
    [Column("created_date")]
    public DateTime CreatedDate { get; set; }
    
    /// <summary>
    /// Related items to be ordered
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OrderItem> OrderItems { get; set; } = [];
    
    /// <summary>
    /// Related client
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public Client Client { get; set; } = null!;

    /// <summary>
    /// The latest date when the order needs to be delivered to the client
    /// Can be null only in state <see cref="OrderState.New"/>
    /// </summary>
    [Column("required_delivery_date")]
    public DateOnly? RequiredDeliveryDate { get; set; }
    
    /// <summary>
    /// Date when the order was actually delivered to the client
    /// Null if the order has not been delivered yet
    /// </summary>
    [Column("actual_delivery_date")]
    public DateOnly? ActualDeliveryDate { get; set; }

    /// <summary>
    /// ID of related <see cref="Entities.OutgoingShipmentStop"/>, if any
    /// </summary>
    [Column("outgoing_shipment_stop_id")]
    public long? OutgoingShipmentStopId { get; set; }

    /// <summary>
    /// Related <see cref="Entities.OutgoingShipmentStop"/>, if any
    /// </summary>
    public OutgoingShipmentStop? OutgoingShipmentStop { get; set; }

    /// <inheritdoc />
    protected override OrderState CancelledStatus => OrderState.Cancelled;
}