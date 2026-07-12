using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents an extra product item included in an outgoing shipment (not tied to a client order) - to be stored in the inventory
/// </summary>
[Table("outgoing_shipment_inventory_extra_items")]
public sealed class OutgoingShipmentInventoryExtraItem : PublicEntity
{
    /// <summary>
    /// ID of the outgoing shipment
    /// </summary>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// ID of the product
    /// </summary>
    [Column("product_id")]
    public long ProductId { get; set; }

    /// <summary>
    /// Extra quantity of the product to be stored in the inventory
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
    /// Product associated with this extra item
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public Product Product { get; set; } = null!;
}
