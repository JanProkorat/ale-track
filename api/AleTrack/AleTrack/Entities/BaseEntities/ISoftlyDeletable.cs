namespace AleTrack.Entities.BaseEntities;

/// <summary> 
/// Interface for DB entities which should implement soft delete mechanism
/// </summary>
public interface ISoftlyDeletable
{
    /// <summary>
    /// Indicates if entity is softly deleted or active
    /// </summary>
    public bool IsDeleted { get; set; }
}