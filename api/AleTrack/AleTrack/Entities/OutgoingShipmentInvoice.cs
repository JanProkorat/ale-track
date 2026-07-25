using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// One invoice to be issued for a client as part of an outgoing shipment.
/// </summary>
/// <remarks>
/// Invoices are always created per outgoing shipment — by default one per client,
/// covering everything that client receives on the run. A client can have more than
/// one, distinguished by <see cref="Sequence"/>.
///
/// This entity carries no document data (number, date, state) on purpose: this phase
/// only records how the shipment's items split across invoices. Document generation
/// is a later, additive step.
/// </remarks>
[Table("outgoing_shipment_invoices")]
[Index(nameof(OutgoingShipmentId), nameof(ClientId), nameof(Sequence), IsUnique = true)]
public sealed class OutgoingShipmentInvoice : PublicEntity
{
    /// <summary>
    /// ID of the related <see cref="OutgoingShipment"/>
    /// </summary>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// ID of the <see cref="Client"/> this invoice is issued to — the payer.
    /// </summary>
    /// <remarks>
    /// Not necessarily the client who ordered the goods on it; see
    /// <see cref="OutgoingShipmentInvoiceLine"/>.
    /// </remarks>
    [Column("client_id")]
    public long ClientId { get; set; }

    /// <summary>
    /// Position of this invoice among the client's invoices within the shipment, starting at 1.
    /// </summary>
    /// <remarks>
    /// Ordering only — this is not an invoice number.
    /// </remarks>
    [Column("sequence")]
    public int Sequence { get; set; }

    /// <summary>
    /// Outgoing shipment this invoice belongs to
    /// </summary>
    public OutgoingShipment OutgoingShipment { get; set; } = null!;

    /// <summary>
    /// Client this invoice is issued to
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public Client Client { get; set; } = null!;

    /// <summary>
    /// Lines of this invoice
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OutgoingShipmentInvoiceLine> Lines { get; set; } = [];
}
