using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// A garage sale — goods sold off the warehouse shelf to a customer standing at the HQ.
/// </summary>
/// <remarks>
/// A sale is assembled in <see cref="SaleState.Draft"/> with inventory untouched, and becomes
/// <see cref="SaleState.Completed"/> only through the complete command, which deducts the sold
/// pieces from <see cref="InventoryItem.Quantity"/> and freezes the record. This is the third
/// writer of the stock ledger, alongside naskladnění of a product delivery and the dokládka on
/// an outgoing shipment.
/// </remarks>
[Table("sales")]
[Index(nameof(ClientId))]
[Index(nameof(State))]
[Index(nameof(SaleDate))]
public sealed class Sale : PublicEntity
{
    /// <summary>
    /// Date the goods changed hands.
    /// </summary>
    [Column("sale_date")]
    public required DateOnly SaleDate { get; set; }

    /// <summary>
    /// Lifecycle state of the sale.
    /// </summary>
    [Column("state")]
    public required SaleState State { get; set; }

    /// <summary>
    /// Whether the buyer is an existing client or a one-off walk-in.
    /// </summary>
    [Column("buyer_kind")]
    public required SaleBuyerKind BuyerKind { get; set; }

    /// <summary>
    /// ID of the buying <see cref="Entities.Client"/>. Non-null exactly when
    /// <see cref="BuyerKind"/> is <see cref="SaleBuyerKind.Client"/>.
    /// </summary>
    [Column("client_id")]
    public long? ClientId { get; set; }

    /// <summary>
    /// Free-text name of a walk-in buyer. Optional even for a walk-in — an anonymous cash sale
    /// needs no name at all.
    /// </summary>
    [MaxLength(100)]
    [Column("buyer_name")]
    public string? BuyerName { get; set; }

    /// <summary>
    /// How the sale is paid for.
    /// </summary>
    [Column("payment")]
    public required SalePaymentMethod Payment { get; set; }

    /// <summary>
    /// Billing details. Null for a cash sale.
    /// </summary>
    public SaleBillingDetails? Billing { get; set; }

    /// <summary>
    /// Free-form note about the sale.
    /// </summary>
    [MaxLength(500)]
    [Column("note")]
    public string? Note { get; set; }

    /// <summary>
    /// When the sale was completed and the stock deducted. Null while it is a draft.
    /// </summary>
    [Column("completed_at")]
    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>
    /// ID of the <see cref="User"/> who rang the sale up.
    /// </summary>
    [Column("sold_by_user_id")]
    public long? SoldByUserId { get; set; }

    /// <summary>
    /// The buying client.
    /// </summary>
    /// <remarks>
    /// Restrict, not the EF default: a client who has bought something must not be deletable out
    /// from under the sales history — the same reasoning as <see cref="OrderItem.Product"/>.
    /// </remarks>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Client? Client { get; set; }

    /// <summary>
    /// The user who rang the sale up. SetNull, so closing an account keeps the sale.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.SetNull)]
    public User? SoldByUser { get; set; }

    /// <summary>
    /// Lines sold in this sale.
    /// </summary>
    public List<SaleItem> Items { get; set; } = [];
}
