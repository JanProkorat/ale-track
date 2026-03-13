using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

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
    /// Number of pieces to be put on the first invoice
    /// </summary>
    [Column("first_invoice_quantity")]
    public int? FirstInvoiceQuantity { get; set; }
    
    /// <summary>
    /// Number of pieces to be put on the second invoice
    /// </summary>
    [Column("second_invoice_quantity")]
    public int? SecondInvoiceQuantity { get; set; }
    
    /// <summary>
    /// Outgoing shipment associated with this extra item
    /// </summary>
    public OutgoingShipment OutgoingShipment { get; set; } = null!;
}