using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

[Table("outgoing_shipments")]
public sealed class OutgoingShipment
{
    /// <summary>
    /// Name of the outgoing shipment
    /// </summary>
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Date of delivery
    /// </summary>
    public DateTime DeliveryDate { get; set; }
    
    
}