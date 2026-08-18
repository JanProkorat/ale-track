using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// A line on an order that buys something off a <see cref="Supplier"/>'s price list —
/// a CO₂ refill, a crate, sanitation fluid — rather than beer from a brewery.
/// </summary>
/// <remarks>
/// Its own entity rather than a nullable <see cref="OrderItem.ProductId"/>: an order item
/// is assumed everywhere downstream to have a product and through it a brewery — the
/// nakládka sections rows by brewery, the invoice split and the content snapshot both read
/// <see cref="OrderItem.Product"/>. Making that nullable would put a null check in every one
/// of those readers. Keeping supplier goods in a separate collection means the loading table
/// simply never sees them, which is the behaviour we want anyway.
///
/// Modelled on <see cref="OrderCustomExtraItem"/>, the existing "part of the order but not a
/// brewery product" line. The difference is that this one points at a real priced entity
/// instead of carrying free text.
/// </remarks>
[Table("order_supplier_good_items")]
public sealed class OrderSupplierGoodItem : PublicEntity
{
    /// <summary>
    /// ID of related <see cref="Entities.Order"/>
    /// </summary>
    [Column("order_id")]
    public long OrderId { get; set; }

    /// <summary>
    /// ID of the ordered <see cref="Entities.SupplierGood"/>
    /// </summary>
    [Column("supplier_good_id")]
    public long SupplierGoodId { get; set; }

    /// <summary>
    /// Quantity ordered
    /// </summary>
    [Column("quantity")]
    public int Quantity { get; set; }

    /// <summary>
    /// Optional free-form note about this line — an instruction for whoever packs or
    /// delivers it.
    /// </summary>
    [MaxLength(500)]
    [Column("note")]
    public string? Note { get; set; }

    /// <summary>
    /// The parent <see cref="Entities.Order"/>.
    /// </summary>
    public Order Order { get; set; } = null!;

    /// <summary>
    /// The ordered goods.
    /// </summary>
    /// <remarks>
    /// Restrict, matching <see cref="OrderItem.Product"/>: removing a good off a supplier's
    /// price list must not delete the orders that bought it.
    /// </remarks>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public SupplierGood SupplierGood { get; set; } = null!;
}
