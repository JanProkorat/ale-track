namespace AleTrack.Entities.BaseEntities;

/// <summary>
/// Interface for DB entities which should implement soft delete mechanism with enumeration
/// </summary>
public interface IEnumSoftlyDeletable
{
    /// <summary>
    /// Method implementing soft delete by setting the appropriate status
    /// </summary>
    void SoftDelete();
}