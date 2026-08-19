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
    /// Where this order is delivered. The order is the source of truth; the
    /// outgoing-shipment stop inherits this and may override it.
    /// </summary>
    [Column("delivery_address_kind")]
    public DeliveryAddressKind DeliveryAddressKind { get; set; }

    /// <summary>
    /// The client's saved delivery place this order goes to. Set only when
    /// <see cref="DeliveryAddressKind"/> is
    /// <see cref="Common.Enums.DeliveryAddressKind.DeliveryPlace"/>.
    /// </summary>
    [Column("client_delivery_place_id")]
    public long? ClientDeliveryPlaceId { get; set; }

    /// <summary>
    /// Delivery place this order goes to. Deliberately resolvable even when
    /// soft-deleted, so an order pointing at a since-removed place keeps
    /// rendering its address.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public ClientDeliveryPlace? ClientDeliveryPlace { get; set; }

    /// <summary>
    /// Date when the order was created
    /// </summary>
    [Column("created_date")]
    public DateTime CreatedDate { get; set; }

    /// <summary>
    /// Free-form notes about the order (e.g. "dovézt dopoledne")
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OrderNote> Notes { get; set; } = [];

    /// <summary>
    /// Items the client wants that no brewery supplies — billed with the order.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OrderCustomExtraItem> CustomExtraItems { get; set; } = [];

    /// <summary>
    /// Lines bought off a supplier's price list — gas, packaging, sanitation. Deliberately
    /// separate from <see cref="OrderItems"/>, which the loading table and the invoice split
    /// both assume to be brewery products.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OrderSupplierGoodItem> SupplierGoodItems { get; set; } = [];
    
    /// <summary>
    /// Related items to be ordered
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OrderItem> OrderItems { get; set; } = [];

    /// <summary>
    /// Returnable items the client hands back against this order (empty kegs, bottles…)
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OrderReturn> Returns { get; set; } = [];

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

    /// <summary>
    /// Planning state of the order
    /// </summary>
    /// <exception cref="ArgumentOutOfRangeException"></exception>
    public PlanningState PlanningState
    {
        get
        {
            return State switch
            {
                OrderState.New or OrderState.Planning or OrderState.Delivering => PlanningState.Active,
                OrderState.Finished => PlanningState.Finished,
                OrderState.Cancelled => PlanningState.Cancelled,
                _ => throw new ArgumentOutOfRangeException()
            };
        }
    }
}