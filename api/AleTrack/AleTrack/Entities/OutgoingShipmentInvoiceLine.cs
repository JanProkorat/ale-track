using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// A quantity of one shipment item billed on one <see cref="OutgoingShipmentInvoice"/>, or —
/// when <see cref="InvoiceId"/> is null — deliberately kept off every invoice.
/// </summary>
/// <remarks>
/// The source is identified by <see cref="SourceKind"/> plus the matching nullable FK —
/// the same pattern <see cref="OutgoingShipmentStop"/> uses for order vs. custom stops.
/// Exactly one of the three FKs is set.
///
/// <see cref="Quantity"/> can be a fraction of the source item's total, so one order item
/// may appear on several invoices. Reconciliation guarantees that the quantities of all
/// lines referencing a given source item sum to that item's quantity.
///
/// The <em>ordering</em> client is deliberately not stored here — it is derived from the
/// source (the order's client, or the extra item's client). A line is cross-client when
/// that client differs from its invoice's <see cref="OutgoingShipmentInvoice.ClientId"/>.
/// </remarks>
[Table("outgoing_shipment_invoice_lines")]
public sealed class OutgoingShipmentInvoiceLine : PublicEntity
{
    /// <summary>
    /// ID of the <see cref="OutgoingShipment"/> the billed pieces travel on.
    /// </summary>
    /// <remarks>
    /// Present on every line, including invoiced ones, so private lines — which have no
    /// invoice to hang off — can still be found per shipment and cascade with it.
    /// </remarks>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// ID of the related <see cref="OutgoingShipmentInvoice"/>, or null when these pieces are
    /// private: carried and delivered, but excluded from every invoice.
    /// </summary>
    [Column("invoice_id")]
    public long? InvoiceId { get; set; }

    /// <summary>
    /// Whether these pieces are deliberately excluded from every invoice — <em>soukromé</em>.
    /// </summary>
    /// <remarks>
    /// Redundant with a null <see cref="InvoiceId"/>, and kept in step with it by a check
    /// constraint. It exists because EF assigns foreign keys only on save: a line just added to an
    /// invoice still has a null <see cref="InvoiceId"/> in memory, so deciding "is this private?"
    /// from the FK would misread every unsaved line. This flag is right the moment the line is
    /// built, which is what reconciliation and the move endpoint reason about.
    /// </remarks>
    [Column("is_private")]
    public bool IsPrivate { get; set; }

    /// <summary>
    /// Which kind of shipment item this line bills for.
    /// </summary>
    [Column("source_kind")]
    public InvoiceLineSourceKind SourceKind { get; set; }

    /// <summary>
    /// Number of pieces billed on this line.
    /// </summary>
    [Column("quantity")]
    public int Quantity { get; set; }

    /// <summary>
    /// ID of the billed <see cref="OrderItem"/>. Set only when
    /// <see cref="SourceKind"/> is <see cref="InvoiceLineSourceKind.OrderItem"/>.
    /// </summary>
    [Column("order_item_id")]
    public long? OrderItemId { get; set; }


    /// <summary>
    /// ID of the billed <see cref="OrderCustomExtraItem"/>. Set only when
    /// <see cref="SourceKind"/> is <see cref="InvoiceLineSourceKind.CustomExtraItem"/>.
    /// </summary>
    [Column("custom_extra_item_id")]
    public long? CustomExtraItemId { get; set; }

    /// <summary>
    /// Invoice this line belongs to. Null when the pieces are private.
    /// </summary>
    public OutgoingShipmentInvoice? Invoice { get; set; }

    /// <summary>
    /// Billed order item. Null unless <see cref="SourceKind"/> is
    /// <see cref="InvoiceLineSourceKind.OrderItem"/>.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public OrderItem? OrderItem { get; set; }


    /// <summary>
    /// Billed custom extra item. Null unless <see cref="SourceKind"/> is
    /// <see cref="InvoiceLineSourceKind.CustomExtraItem"/>.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public OrderCustomExtraItem? CustomExtraItem { get; set; }
}
