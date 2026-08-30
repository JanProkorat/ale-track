using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// One thing that happened to a client differently from how it was planned — pieces not
/// unloaded, empties not handed back, money owed either way, a delivery that went elsewhere.
/// </summary>
/// <remarks>
/// The delta sits <em>beside</em> the order rather than inside it, so the order stays the plan
/// and the papers printed before the run stay true. Reality is computed: plan plus entries.
///
/// The owner is the <see cref="Client"/>, not the order — <see cref="OrderId"/> is nullable
/// precisely so a debt can exist with no delivery behind it ("owes 2 400 from last time"),
/// which is the case an order note could never carry.
///
/// The difference between <see cref="PlannedQuantity"/> and <see cref="ActualQuantity"/> is
/// never stored. A stored difference is a third number that can stop agreeing with the first
/// two.
/// </remarks>
[Table("client_ledger_entries")]
public sealed class ClientLedgerEntry : PublicEntity
{
    /// <summary>
    /// ID of the owning <see cref="Entities.Client"/>.
    /// </summary>
    [Column("client_id")]
    public long ClientId { get; set; }

    /// <summary>
    /// ID of the <see cref="Entities.Order"/> this came off, if any. Null for a standalone debt.
    /// </summary>
    [Column("order_id")]
    public long? OrderId { get; set; }

    /// <summary>
    /// ID of the <see cref="OutgoingShipmentStop"/> it happened at. Provenance: which stop of
    /// which run.
    /// </summary>
    [Column("stop_id")]
    public long? StopId { get; set; }

    /// <summary>
    /// What diverged.
    /// </summary>
    [Column("target")]
    public ClientLedgerEntryTarget Target { get; set; }

    /// <summary>
    /// The beer line this is about. Set for <see cref="ClientLedgerEntryTarget.ProductQuantity"/>.
    /// </summary>
    [Column("order_item_id")]
    public long? OrderItemId { get; set; }

    /// <summary>
    /// The product of that line, kept alongside <see cref="OrderItemId"/> as a display key and
    /// as the fallback for a line that was removed and re-added.
    /// </summary>
    [Column("product_id")]
    public long? ProductId { get; set; }

    /// <summary>
    /// Product name as it was when the entry was written, so the row stays readable after the
    /// product is retired.
    /// </summary>
    [MaxLength(100)]
    [Column("product_name")]
    public string? ProductName { get; set; }

    /// <summary>
    /// The supplier-good line this is about. Set for
    /// <see cref="ClientLedgerEntryTarget.SupplierGoodQuantity"/>.
    /// </summary>
    [Column("supplier_good_item_id")]
    public long? SupplierGoodItemId { get; set; }

    /// <summary>
    /// The good of that line, kept alongside <see cref="SupplierGoodItemId"/> for the reason
    /// <see cref="ProductId"/> is kept alongside <see cref="OrderItemId"/>: it is what identifies
    /// a good handed over with no line on the order at all.
    /// </summary>
    [Column("supplier_good_id")]
    public long? SupplierGoodId { get; set; }

    /// <summary>
    /// Good name as it was when the entry was written, so the row stays readable after the good
    /// leaves the supplier's price list.
    /// </summary>
    [MaxLength(100)]
    [Column("good_name")]
    public string? GoodName { get; set; }

    /// <summary>
    /// The custom extra line this is about. Set for
    /// <see cref="ClientLedgerEntryTarget.CustomExtraQuantity"/>.
    /// </summary>
    [Column("custom_extra_item_id")]
    public long? CustomExtraItemId { get; set; }

    /// <summary>
    /// The returns line this is about. Set for
    /// <see cref="ClientLedgerEntryTarget.ReturnQuantity"/>.
    /// </summary>
    [Column("order_return_id")]
    public long? OrderReturnId { get; set; }

    /// <summary>
    /// Name of the affected line for the non-product targets, and for anything handed over
    /// that the order never planned.
    /// </summary>
    [MaxLength(200)]
    [Column("line_name")]
    public string? LineName { get; set; }

    /// <summary>
    /// How many pieces the plan said. Zero for something that was never planned at all.
    /// </summary>
    [Column("planned_quantity")]
    public int? PlannedQuantity { get; set; }

    /// <summary>
    /// How many pieces actually changed hands.
    /// </summary>
    [Column("actual_quantity")]
    public int? ActualQuantity { get; set; }

    /// <summary>
    /// The old value for <see cref="ClientLedgerEntryTarget.DeliveryAddress"/>. Kept as the
    /// <em>original</em> across repeated redirections — what matters is where it was meant to
    /// go, not where it was meant to go in between.
    /// </summary>
    [MaxLength(500)]
    [Column("planned_text")]
    public string? PlannedText { get; set; }

    /// <summary>
    /// The new value for <see cref="ClientLedgerEntryTarget.DeliveryAddress"/>.
    /// </summary>
    [MaxLength(500)]
    [Column("actual_text")]
    public string? ActualText { get; set; }

    /// <summary>
    /// Money owed, signed: positive means the client owes us. CZK, the only currency this
    /// project bills in.
    /// </summary>
    [Column("amount", TypeName = "decimal(18,2)")]
    public decimal? Amount { get; set; }

    /// <summary>
    /// Why it happened, in the dispatcher's own words.
    /// </summary>
    [MaxLength(1000)]
    [Column("note")]
    public string? Note { get; set; }

    /// <summary>
    /// Whether this is a debt to settle rather than a mere record.
    /// </summary>
    /// <remarks>
    /// Not simply "the numbers differ": pieces delivered over the plan are with the client and
    /// get billed, so they need no follow-up, whereas returns need it in both directions —
    /// short means the client still owes empties, over means we hold deposits that are not
    /// ours. A <see cref="ClientLedgerEntryTarget.DeliveryAddress"/> entry never needs it.
    /// </remarks>
    [Column("requires_follow_up")]
    public bool RequiresFollowUp { get; set; }

    /// <summary>
    /// When it was settled. Null while it is still open or merely assigned.
    /// </summary>
    [Column("resolved_at")]
    public DateTime? ResolvedAt { get; set; }

    /// <summary>
    /// ID of the <see cref="User"/> who settled it.
    /// </summary>
    [Column("resolved_by_user_id")]
    public long? ResolvedByUserId { get; set; }

    /// <summary>
    /// How it was settled.
    /// </summary>
    [MaxLength(1000)]
    [Column("resolution_note")]
    public string? ResolutionNote { get; set; }

    /// <summary>
    /// ID of the <see cref="Entities.Order"/> carrying the settlement, set while
    /// <see cref="ResolvedAt"/> is still null.
    /// </summary>
    /// <remarks>
    /// The middle state — assigned but not resolved — is a safeguard, not a luxury. Closing the
    /// entry the moment somebody clicks "add to order" would make the debt vanish if that order
    /// were later cancelled, which is the exact failure this whole record exists to prevent.
    /// Promising is not delivering.
    /// </remarks>
    [Column("resolved_by_order_id")]
    public long? ResolvedByOrderId { get; set; }

    /// <summary>
    /// When the entry was written.
    /// </summary>
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// ID of the <see cref="User"/> who wrote it.
    /// </summary>
    /// <remarks>
    /// No other entity here records its author. It is deliberate on this one: "who wrote this,
    /// and when" is the first question a disputed debt raises.
    /// </remarks>
    [Column("created_by_user_id")]
    public long? CreatedByUserId { get; set; }

    /// <summary>
    /// The owning client. Cascade: deleting a client drops its ledger with it.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Client Client { get; set; } = null!;

    /// <summary>
    /// The order this came off. SetNull — losing the provenance must not lose the debt, which
    /// is what the name snapshots are for.
    /// </summary>
    public Order? Order { get; set; }

    /// <summary>
    /// The stop it happened at.
    /// </summary>
    public OutgoingShipmentStop? Stop { get; set; }

    /// <summary>
    /// The affected beer line.
    /// </summary>
    public OrderItem? OrderItem { get; set; }

    /// <summary>
    /// The affected product.
    /// </summary>
    public Product? Product { get; set; }

    /// <summary>
    /// The affected supplier-good line.
    /// </summary>
    public OrderSupplierGoodItem? SupplierGoodItem { get; set; }

    /// <summary>
    /// The good itself, for a good handed over without a line on the order.
    /// </summary>
    public SupplierGood? SupplierGood { get; set; }

    /// <summary>
    /// The affected custom extra line.
    /// </summary>
    public OrderCustomExtraItem? CustomExtraItem { get; set; }

    /// <summary>
    /// The affected returns line.
    /// </summary>
    public OrderReturn? OrderReturn { get; set; }

    /// <summary>
    /// Who settled it.
    /// </summary>
    public User? ResolvedByUser { get; set; }

    /// <summary>
    /// The order carrying the settlement.
    /// </summary>
    public Order? ResolvedByOrder { get; set; }

    /// <summary>
    /// Who wrote it.
    /// </summary>
    public User? CreatedByUser { get; set; }
}
