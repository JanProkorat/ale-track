using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents an extra product item included in an outgoing shipment that is taken from the inventory and is delivered to the client
/// </summary>
[Table("outgoing_shipment_client_extra_items")]
public sealed class OutgoingShipmentClientExtraItem : PublicEntity
{
    /// <summary>
    /// ID of the outgoing shipment
    /// </summary>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// ID of the related inventory item this extra product was taken from
    /// </summary>
    [Column("inventory_item_id")]
    public long InventoryItemId { get; set; }

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

    /// <summary>
    /// Inventory item this extra product was taken from
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public InventoryItem InventoryItem { get; set; } = null!;
}
