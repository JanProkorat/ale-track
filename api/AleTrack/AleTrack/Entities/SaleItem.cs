using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// One line of a <see cref="Sale"/> — what was sold, how many, and for how much.
/// </summary>
/// <remarks>
/// The descriptive columns are snapshots taken when the line was added, following
/// <see cref="OutgoingShipmentStopItem"/>: a completed sale must stay readable after the product
/// is retired or the ceník moves. <see cref="ProductId"/> and <see cref="InventoryItemId"/> are
/// provenance links only, and go null rather than taking the line with them.
/// </remarks>
[Table("sale_items")]
[Index(nameof(SaleId))]
[Index(nameof(InventoryItemId))]
public sealed class SaleItem : PublicEntity
{
    /// <summary>
    /// ID of the owning <see cref="Entities.Sale"/>.
    /// </summary>
    [Column("sale_id")]
    public long SaleId { get; set; }

    /// <summary>
    /// ID of the <see cref="Entities.InventoryItem"/> this line draws its pieces from.
    /// Null once that stock row is gone.
    /// </summary>
    [Column("inventory_item_id")]
    public long? InventoryItemId { get; set; }

    /// <summary>
    /// ID of the sold <see cref="Entities.Product"/>. Null for a free-form stock item, or once
    /// the product is hard-deleted.
    /// </summary>
    [Column("product_id")]
    public long? ProductId { get; set; }

    /// <summary>
    /// Item name as it was when sold.
    /// </summary>
    [MaxLength(100)]
    [Column("name")]
    public required string Name { get; set; }

    /// <summary>
    /// Packaging as it was when sold — sud, basa, plechovka. Null for a free-form stock item, which
    /// has no product behind it to have a packaging.
    /// </summary>
    /// <remarks>
    /// Snapshotted alongside <see cref="PackageSize"/> for the same reason: the product's kind is
    /// derived from its container and sale unit, both of which an admin can change later.
    /// </remarks>
    [Column("kind")]
    public ProductKind? Kind { get; set; }

    /// <summary>
    /// Container volume in litres as it was when sold.
    /// </summary>
    [Column("package_size")]
    public double? PackageSize { get; set; }

    /// <summary>
    /// Pieces sold.
    /// </summary>
    [Column("quantity")]
    public required int Quantity { get; set; }

    /// <summary>
    /// Price per piece actually charged, with VAT.
    /// </summary>
    [Column("unit_price_with_vat")]
    public required decimal UnitPriceWithVat { get; set; }

    /// <summary>
    /// Ceník price per piece with VAT at the time of sale. Null for a free-form stock item, which
    /// has no ceník entry.
    /// </summary>
    /// <remarks>
    /// Kept alongside <see cref="UnitPriceWithVat"/> so a discount given at the counter stays
    /// visible after the ceník changes.
    /// </remarks>
    [Column("list_price_with_vat")]
    public decimal? ListPriceWithVat { get; set; }

    /// <summary>
    /// Free-form note about this line — what the counter agreed on for these particular pieces
    /// ("vrátí basy v pátek"), as opposed to the sale as a whole.
    /// </summary>
    /// <remarks>
    /// Mirrors <see cref="OrderItem.Note"/>. Not part of the snapshot: it records an arrangement
    /// rather than what the goods were, so it carries no history-integrity weight.
    /// </remarks>
    [MaxLength(500)]
    [Column("note")]
    public string? Note { get; set; }

    /// <summary>
    /// The owning sale.
    /// </summary>
    public Sale Sale { get; set; } = null!;

    /// <summary>
    /// Provenance link to the stock row the pieces came from.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.SetNull)]
    public InventoryItem? InventoryItem { get; set; }

    /// <summary>
    /// Provenance link to the sold product.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.SetNull)]
    public Product? Product { get; set; }
}
