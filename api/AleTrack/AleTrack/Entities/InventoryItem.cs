using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Entity representing one item in the inventory
/// </summary>
/// <remarks>
/// A row is one of three things: a brewery <see cref="Product"/>, one of a supplier's
/// <see cref="Entities.SupplierGood"/>s, or a hand-written row that is neither and carries only a
/// <see cref="Name"/>. At most one of the two references is set, which a check constraint enforces —
/// see <c>InventoryItemConfiguration</c>.
/// </remarks>
[Table("inventory_items")]
public sealed class InventoryItem : PublicEntity
{
    /// <summary>
    /// ID of related <see cref="Product"/> - Null if no regular brewery product is related
    /// </summary>
    [Column("product_id")]
    public long? ProductId { get; set; }

    /// <summary>
    /// ID of the related <see cref="Entities.SupplierGood"/> — set on stock booked in from a
    /// supplier stop of a dovoz.
    /// </summary>
    /// <remarks>
    /// A reference rather than a copied name, for the reason the good's own identity exists at all:
    /// renaming it in the ceník has to keep this stock row, and the next dovoz carrying it has to
    /// find this row to increment rather than start a second one beside it.
    ///
    /// One row per good, whatever charge kind the delivery line was priced under: a row counts a
    /// full bottle, and Plnění and Nákup both bring one home. Záloha and Nájem lines increment it
    /// too — a deliberate choice, though a deposit is a charge rather than something arriving.
    /// </remarks>
    [Column("supplier_good_id")]
    public long? SupplierGoodId { get; set; }

    /// <summary>
    /// Name of the item - not null only if it is related to neither a product nor a supplier's goods
    /// </summary>
    [MaxLength(50)]
    [Column("name")]
    public string? Name { get; set; }
    
    /// <summary>
    /// Amount of products currently in inventory
    /// </summary>
    [Column("quantity")]
    public int Quantity { get; set; }
    
    /// <summary>
    /// Related <see cref="Product"/>
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public Product? Product { get; set; }

    /// <summary>
    /// Related <see cref="Entities.SupplierGood"/>
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public SupplierGood? SupplierGood { get; set; }
    
    /// <summary>
    /// Note to the item
    /// </summary>
    [MaxLength(200)]
    [Column("note")]
    public string? Note { get; set; }
}