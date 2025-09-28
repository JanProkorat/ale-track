using System.ComponentModel.DataAnnotations.Schema;

namespace AleTrack.Entities.BaseEntities;

/// <summary>
/// Represents a base entity that supports a soft delete mechanism.
/// </summary>
/// <remarks>
/// Entities inheriting from this class can be marked as deleted without being physically removed from the database.
/// This is useful for maintaining historical data and audit trails.
/// </remarks>
public class PublicSoftlyDeletableEntity : PublicEntity, ISoftlyDeletable
{
    /// <summary>
    /// Indicates whether the entity has been marked as deleted in the context of a soft delete mechanism.
    /// </summary>
    /// <remarks>
    /// When set to <c>true</c>, the entity is considered deleted but not physically removed from the database.
    /// This allows for data recovery and historical record keeping while preventing the entity from being actively used.
    /// </remarks>
    [Column("is_deleted")]
    public bool IsDeleted { get; set; }
}