using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a custom extra item in an outgoing shipment
/// </summary>
[Table("outgoing_shipment_custom_extra_items")]
public class OutgoingShipmentCustomExtraItem : PublicEntity
{
    /// <summary>
    /// ID of the outgoing shipment
    /// </summary>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// Description of the extra item
    /// </summary>
    [MaxLength(200)]
    [Column("description")]
    public string Description { get; set; } = null!;
    
    /// <summary>
    /// Quantity of the product to be delivered to the client
    /// </summary>
    [Column("quantity")]
    public int Quantity { get; set; }
    
    /// <summary>
    /// Flag indicating whether the loading in a related outgoing shipment is confirmed.
    /// </summary>
    [Column("is_shipment_loading_confirmed")]
    public bool IsShipmentLoadingConfirmed { get; set; }
    
    /// <summary>
    /// ID of the <see cref="Client"/> this extra item is delivered to.
    /// </summary>
    /// <remarks>
    /// Needed for invoicing: the item is billable, so it has to default onto that client's
    /// invoice. Nullable because rows created before invoicing existed have no client
    /// recorded — treat null as "not yet attributed" rather than "nobody".
    /// </remarks>
    [Column("client_id")]
    public long? ClientId { get; set; }

    /// <summary>
    /// Outgoing shipment associated with this extra item
    /// </summary>
    public OutgoingShipment OutgoingShipment { get; set; } = null!;

    /// <summary>
    /// Client this extra item is delivered to
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public Client? Client { get; set; }
}