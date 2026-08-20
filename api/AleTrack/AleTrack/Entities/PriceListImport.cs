using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Record of one price list having been applied to a brewery's products.
/// </summary>
/// <remarks>
/// Prices used to arrive with no trace of where they came from, which is how the seeded catalogue
/// drifted two years behind the brewery without anyone being able to tell. Each apply writes one of
/// these, so any price can be traced back to the list and the date that set it.
/// </remarks>
[Table("price_list_imports")]
public sealed class PriceListImport : PublicEntity
{
    /// <summary>
    /// ID of the <see cref="Brewery"/> whose products were repriced.
    /// </summary>
    [Column("brewery_id")]
    public long BreweryId { get; set; }

    /// <summary>
    /// Date the applied list takes effect, as stated by the importing user.
    /// </summary>
    [Column("effective_from")]
    public DateOnly EffectiveFrom { get; set; }

    /// <summary>
    /// Where the list came from — the uploaded file's name, or the catalogue file's source line.
    /// </summary>
    [MaxLength(200)]
    [Column("source_name")]
    public string? SourceName { get; set; }

    /// <summary>
    /// SHA-256 of the normalised file content, the same value the preview handed out.
    /// </summary>
    [MaxLength(64)]
    [Required]
    [Column("source_hash")]
    public string SourceHash { get; set; } = null!;

    /// <summary>
    /// When the import was applied.
    /// </summary>
    [Column("imported_at")]
    public DateTimeOffset ImportedAt { get; set; }

    /// <summary>
    /// ID of the <see cref="User"/> who applied it, when the request carried an identifiable one.
    /// </summary>
    [Column("imported_by_user_id")]
    public long? ImportedByUserId { get; set; }

    /// <summary>
    /// How many products the import created.
    /// </summary>
    [Column("added_count")]
    public int AddedCount { get; set; }

    /// <summary>
    /// How many products it repriced or otherwise changed.
    /// </summary>
    [Column("updated_count")]
    public int UpdatedCount { get; set; }

    /// <summary>
    /// How many products it removed. Removal is soft, so the count is recoverable.
    /// </summary>
    [Column("removed_count")]
    public int RemovedCount { get; set; }

    /// <summary>
    /// Related <see cref="Brewery"/>.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Brewery Brewery { get; set; } = null!;

    /// <summary>
    /// Related <see cref="User"/>.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public User? ImportedByUser { get; set; }
}
