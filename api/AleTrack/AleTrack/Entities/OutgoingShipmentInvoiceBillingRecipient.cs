using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// A sub-client whose official address is shown on one <see cref="OutgoingShipmentInvoice"/> as an
/// address the payer should invoice.
/// </summary>
/// <remarks>
/// A payer's invoice aggregates several sub-clients' goods, and the payer then has to raise its own
/// invoices against them. The office picks which sub-clients to name here; the UI and both export
/// writers render them under "Fakturační adresa pro &lt;payer&gt;".
///
/// <see cref="Address"/> is a copy, not a join: it follows the client while the run's invoicing is
/// still adjustable and freezes once it is not, the same rule
/// <see cref="OutgoingShipmentInvoiceLine"/> applies to its own snapshot.
/// </remarks>
[Table("outgoing_shipment_invoice_billing_recipients")]
[Index(nameof(InvoiceId), nameof(ClientId), IsUnique = true)]
public sealed class OutgoingShipmentInvoiceBillingRecipient : PublicEntity
{
    /// <summary>
    /// ID of the related <see cref="OutgoingShipmentInvoice"/>
    /// </summary>
    [Column("invoice_id")]
    public long InvoiceId { get; set; }

    /// <summary>
    /// ID of the named <see cref="Entities.Client"/> — a sub-client of the invoice's payer.
    /// </summary>
    [Column("client_id")]
    public long ClientId { get; set; }

    /// <summary>
    /// The sub-client's official address as recorded on this invoice.
    /// </summary>
    public Address Address { get; set; } = null!;

    /// <summary>
    /// Invoice this recipient is named on
    /// </summary>
    public OutgoingShipmentInvoice Invoice { get; set; } = null!;

    /// <summary>
    /// The named sub-client
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public Client Client { get; set; } = null!;
}
