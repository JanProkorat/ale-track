using System.ComponentModel.DataAnnotations.Schema;

namespace AleTrack.Entities.BaseEntities;

/// <summary>
/// Abstraction for entities which are softly deletable and have enum status
/// </summary>
/// <typeparam name="TStatus">Enum type representing the status</typeparam>
public abstract class PublicEnumSoftlyDeletableEntity<TStatus> : PublicEntity, IEnumSoftlyDeletable
    where TStatus : struct, Enum
{
    /// <summary>
    /// Enum status representing the state of the entity
    /// </summary>
    [Column("state")]
    public TStatus State { get; set; }

    /// <summary>
    /// Gets the enum status value representing the cancelled/deleted state
    /// </summary>
    protected abstract TStatus CancelledStatus { get; }

    /// <summary>
    /// Method implementing soft delete by setting the appropriate status
    /// </summary>
    public void SoftDelete()
    {
        State = CancelledStatus;
    }
}