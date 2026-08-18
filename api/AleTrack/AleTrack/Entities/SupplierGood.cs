using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// One item on a <see cref="Supplier"/>'s price list — the physical thing, such as a 10 kg
/// CO₂ bottle.
/// </summary>
/// <remarks>
/// Deliberately not a <see cref="Product"/>: a product belongs to a brewery
/// (<see cref="Product.BreweryId"/> is not nullable) and flows through orders, shipments,
/// stock and invoices. A supplier good is a price-list entry and nothing buys against it
/// yet. Its identity is what lets the <see cref="Prices"/> group under one heading instead
/// of being matched by name.
/// </remarks>
[Table("supplier_goods")]
public sealed class SupplierGood : PublicEntity
{
    /// <summary>
    /// ID of related <see cref="Supplier"/>
    /// </summary>
    [Column("supplier_id")]
    public long SupplierId { get; set; }

    /// <summary>
    /// Name of the goods, such as "CO₂ láhev"
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("name")]
    public string Name { get; set; } = null!;

    /// <summary>
    /// Size as the supplier states it — "10 kg", "50 l", "20 ks". Free text because
    /// suppliers measure gas by weight, vessels by volume and packaging by count.
    /// </summary>
    [MaxLength(20)]
    [Column("size")]
    public string? Size { get; set; }

    /// <summary>
    /// Further detail, such as the gas grade or the thread standard
    /// </summary>
    [MaxLength(200)]
    [Column("description")]
    public string? Description { get; set; }

    /// <summary>
    /// One price per charge kind. Never empty — a good with no price is not a price list
    /// entry, which the create/update validators enforce.
    /// </summary>
    public List<SupplierGoodPrice> Prices { get; set; } = [];

    /// <summary>
    /// Related supplier
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Supplier Supplier { get; set; } = null!;

    /// <summary>
    /// The stock of this goods, once a dovoz has booked some in.
    /// </summary>
    /// <remarks>
    /// A reference rather than a collection, mirroring <see cref="Product.InventoryItem"/>: the
    /// warehouse holds one row per thing and a dovoz increments it, so one-to-one is the shape — and
    /// it is what makes the index on inventory_items.supplier_good_id unique, putting that invariant
    /// in the schema instead of trusting every caller to look before inserting.
    /// </remarks>
    public InventoryItem? InventoryItem { get; set; }
}
