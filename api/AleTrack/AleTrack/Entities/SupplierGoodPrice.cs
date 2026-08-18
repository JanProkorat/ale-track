using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// What a <see cref="SupplierGood"/> costs for one <see cref="SupplierChargeKind"/>.
/// </summary>
/// <remarks>
/// The pair (good, kind) is unique — a good cannot have two "Plnění" prices — which is what
/// lets the ceník render each good once with its kinds beneath it.
/// </remarks>
[Table("supplier_good_prices")]
public sealed class SupplierGoodPrice : BaseEntity
{
    /// <summary>
    /// ID of related <see cref="SupplierGood"/>
    /// </summary>
    [Column("supplier_good_id")]
    public long SupplierGoodId { get; set; }

    /// <summary>
    /// What this price charges for
    /// </summary>
    [Column("kind")]
    public SupplierChargeKind Kind { get; set; }

    /// <summary>
    /// Price with VAT, in CZK — the base currency every money column in this app stores
    /// </summary>
    [Column("price_with_vat")]
    public decimal PriceWithVat { get; set; }

    /// <summary>
    /// Price without VAT, when the supplier states it
    /// </summary>
    [Column("price_without_vat")]
    public decimal? PriceWithoutVat { get; set; }

    /// <summary>
    /// Qualifier the price makes no sense without, such as "za měsíc" on rent or
    /// "výměnou za prázdnou" on a refill
    /// </summary>
    [MaxLength(100)]
    [Column("note")]
    public string? Note { get; set; }

    /// <summary>
    /// Related goods
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public SupplierGood SupplierGood { get; set; } = null!;
}
