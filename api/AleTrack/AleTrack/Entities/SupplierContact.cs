using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// A phone number or e-mail address on a <see cref="Supplier"/>. Mirrors
/// <see cref="ClientContact"/> — same shape, own table, so the two can diverge without
/// one module's migration touching the other's rows.
/// </summary>
[Table("supplier_contacts")]
public sealed class SupplierContact : BaseEntity
{
    /// <summary>
    /// ID of related <see cref="Supplier"/>
    /// </summary>
    [Column("supplier_id")]
    public long SupplierId { get; set; }

    /// <summary>
    /// Whether the value is an e-mail address or a phone number
    /// </summary>
    [Column("type")]
    public ContactType Type { get; set; }

    /// <summary>
    /// What this contact is for, such as "Plnírna" or "Objednávky"
    /// </summary>
    [MaxLength(50)]
    [Column("description")]
    public string? Description { get; set; }

    /// <summary>
    /// The phone number or e-mail address itself
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("value")]
    public string Value { get; set; } = null!;

    /// <summary>
    /// Related supplier
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Supplier Supplier { get; set; } = null!;
}
