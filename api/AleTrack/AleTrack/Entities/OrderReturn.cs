using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// A returnable item the client hands back against an order (empty kegs,
/// bottles, crates…). Planned with the order; free-form name + amount, not a
/// catalog product.
/// </summary>
[Table("order_returns")]
public sealed class OrderReturn : PublicEntity
{
    /// <summary>
    /// ID of related <see cref="Entities.Order"/>
    /// </summary>
    [Column("order_id")]
    public long OrderId { get; set; }

    /// <summary>
    /// Name of the returned item (e.g. "Sud 50 l — prázdný")
    /// </summary>
    [MaxLength(200)]
    [Column("name")]
    public string Name { get; set; } = null!;

    /// <summary>
    /// Amount returned
    /// </summary>
    [Column("quantity")]
    public int Quantity { get; set; }

    /// <summary>
    /// Optional free-form note about the returned item
    /// </summary>
    [MaxLength(500)]
    [Column("note")]
    public string? Note { get; set; }

    /// <summary>
    /// The parent <see cref="Entities.Order"/> related to this returned item.
    /// </summary>
    public Order Order { get; set; } = null!;
}
