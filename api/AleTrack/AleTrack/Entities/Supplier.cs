using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Entity representing a supplier of everything but beer — CO₂ and Biogon bottles, crates
/// and kegs, sanitation, merch.
/// </summary>
/// <remarks>
/// A sibling of <see cref="Brewery"/> rather than a variant of it: a brewery's identity is
/// its beer catalogue and its colour in the ceník tab strip, while a supplier has neither
/// and has <see cref="OpeningHours"/> instead — the thing that decides whether a van can be
/// sent there at all. Softly deletable like <see cref="Client"/>, because purchase records
/// will reference a supplier and its id has to stay resolvable afterwards.
/// </remarks>
[Table("suppliers")]
public sealed class Supplier : PublicSoftlyDeletableEntity
{
    /// <summary>
    /// Name of the supplier as the crew refers to it
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("name")]
    public string Name { get; set; } = null!;

    /// <summary>
    /// Registered business name, when it differs from <see cref="Name"/>
    /// </summary>
    [MaxLength(50)]
    [Column("business_name")]
    public string? BusinessName { get; set; }

    /// <summary>
    /// Operational note — what a driver needs to know before setting off, such as which
    /// gate to use or that the place takes no cash.
    /// </summary>
    [MaxLength(500)]
    [Column("note")]
    public string? Note { get; set; }

    /// <summary>
    /// Registered seat of the supplier, used for invoicing
    /// </summary>
    public Address OfficialAddress { get; set; } = null!;

    /// <summary>
    /// Address of the branch actually visited, when it differs from the registered seat
    /// </summary>
    public Address? ContactAddress { get; set; }

    /// <summary>
    /// Phone numbers and e-mail addresses for this supplier
    /// </summary>
    public List<SupplierContact> Contacts { get; set; } = [];

    /// <summary>
    /// Weekly recurring opening hours. A weekday with no interval is closed.
    /// </summary>
    public List<SupplierOpeningHours> OpeningHours { get; set; } = [];

    /// <summary>
    /// The supplier's price list
    /// </summary>
    public List<SupplierGood> Goods { get; set; } = [];

    /// <summary>
    /// Collection of notes associated with the supplier
    /// </summary>
    public List<SupplierNote> Notes { get; set; } = [];
}
