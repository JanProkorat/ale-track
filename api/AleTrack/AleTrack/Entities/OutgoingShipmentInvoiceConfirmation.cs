using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// The office's record that one client's Fakturace row on one run is finished, and the number the
/// export prints it under.
/// </summary>
/// <remarks>
/// Keyed on (shipment, client) rather than on an invoice: a Fakturace row is a client, and a client
/// can hold two invoices on one run, or an invoice with no delivery of its own (a payer), or a
/// delivery with no invoice at all (every piece kept private). Only the pair covers all three.
///
/// A payer's sub-clients have no row of their own — their goods are billed on the payer's invoice —
/// so confirming the payer confirms the whole group at once.
///
/// <see cref="Number"/> counts confirmations, not stops: the first row marked on a run takes 1, the
/// second 2. Un-marking keeps both the row and its number, so re-marking gives the same number back
/// and a number is never printed against two clients.
/// </remarks>
[Table("outgoing_shipment_invoice_confirmations")]
[Index(nameof(OutgoingShipmentId), nameof(ClientId), IsUnique = true)]
[Index(nameof(OutgoingShipmentId), nameof(Number), IsUnique = true)]
public sealed class OutgoingShipmentInvoiceConfirmation : PublicEntity
{
    /// <summary>
    /// ID of the related <see cref="OutgoingShipment"/>
    /// </summary>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// ID of the <see cref="Entities.Client"/> whose row this is — the payer of the row's invoices.
    /// </summary>
    [Column("client_id")]
    public long ClientId { get; set; }

    /// <summary>
    /// Number the export prints this row under, from 1 per shipment. Assigned once and never
    /// reassigned.
    /// </summary>
    [Column("number")]
    public int Number { get; set; }

    /// <summary>
    /// Whether the row is finished. False after un-marking, which keeps <see cref="Number"/>.
    /// </summary>
    [Column("is_ready")]
    public bool IsReady { get; set; }

    /// <summary>
    /// Shipment this confirmation belongs to
    /// </summary>
    public OutgoingShipment OutgoingShipment { get; set; } = null!;

    /// <summary>
    /// Client whose row is confirmed
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public Client Client { get; set; } = null!;
}
