using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// One invoice the <em>brewery issues to us</em> for the goods picked up on an outgoing shipment.
/// </summary>
/// <remarks>
/// The mirror image of <see cref="OutgoingShipmentInvoice"/>, which is what we issue to a client.
/// A run is normally covered by a single brewery invoice; occasionally the brewery splits it, and
/// this records where the line fell.
///
/// The invoice with <see cref="Sequence"/> 1 is the <em>remainder</em>: it holds every piece not
/// claimed by a later invoice and therefore never stores <see cref="Lines"/> of its own. Only
/// exceptions are persisted, so the split cannot drift out of balance.
///
/// No brewery is recorded. With the remainder model, invoice 1 holds whatever was not assigned
/// elsewhere — in a run that picks up at two breweries that spans both, so a single brewery
/// reference on the invoice would be false. The supplier of each piece is derivable from its
/// product.
/// </remarks>
[Table("outgoing_shipment_purchase_invoices")]
[Index(nameof(OutgoingShipmentId), nameof(Sequence), IsUnique = true)]
public sealed class OutgoingShipmentPurchaseInvoice : PublicEntity
{
    /// <summary>
    /// ID of the related <see cref="OutgoingShipment"/>
    /// </summary>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// Position of this invoice within the shipment, starting at 1.
    /// </summary>
    /// <remarks>
    /// Ordering only — this is not an invoice number. The brewery's real number, if the user
    /// bothers to type it, goes in <see cref="Label"/>.
    /// </remarks>
    [Column("sequence")]
    public int Sequence { get; set; }

    /// <summary>
    /// Free-text label for the brewery's own invoice number. Optional.
    /// </summary>
    [Column("label")]
    [MaxLength(30)]
    public string? Label { get; set; }

    /// <summary>
    /// Outgoing shipment this invoice belongs to
    /// </summary>
    public OutgoingShipment OutgoingShipment { get; set; } = null!;

    /// <summary>
    /// Lines of this invoice. Always empty for <see cref="Sequence"/> 1 — see the remarks above.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OutgoingShipmentPurchaseInvoiceLine> Lines { get; set; } = [];
}
