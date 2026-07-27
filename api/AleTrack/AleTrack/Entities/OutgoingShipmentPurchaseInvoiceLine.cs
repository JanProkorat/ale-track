using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// A number of pieces of one product placed on a brewery's invoice to us.
/// </summary>
/// <remarks>
/// Keyed by product, not by source item: a purchase invoice does not care which client ordered
/// the beer, only how many pieces we bought. That makes the aggregated nakládka row the right
/// granularity and removes any need to distribute an aggregate down into per-order items — the
/// problem <c>ShipmentInvoiceReconciler</c> exists to solve on the sales side.
///
/// Only invoices from <see cref="OutgoingShipmentPurchaseInvoice.Sequence"/> 2 upwards carry
/// lines; invoice 1 is the computed remainder.
/// </remarks>
[Table("outgoing_shipment_purchase_invoice_lines")]
[Index(nameof(PurchaseInvoiceId), nameof(ProductId), IsUnique = true)]
public sealed class OutgoingShipmentPurchaseInvoiceLine : PublicEntity
{
    /// <summary>
    /// ID of the related <see cref="OutgoingShipmentPurchaseInvoice"/>
    /// </summary>
    [Column("purchase_invoice_id")]
    public long PurchaseInvoiceId { get; set; }

    /// <summary>
    /// ID of the <see cref="Product"/> these pieces are of
    /// </summary>
    [Column("product_id")]
    public long ProductId { get; set; }

    /// <summary>
    /// Number of pieces of the product on this invoice.
    /// </summary>
    /// <remarks>
    /// Clamped to what the shipment actually buys of the product, minus the other invoices'
    /// claims on it. A line that clamps to zero is deleted.
    /// </remarks>
    [Column("quantity")]
    public int Quantity { get; set; }

    /// <summary>
    /// Invoice this line belongs to
    /// </summary>
    public OutgoingShipmentPurchaseInvoice PurchaseInvoice { get; set; } = null!;

    /// <summary>
    /// Product these pieces are of
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public Product Product { get; set; } = null!;
}
