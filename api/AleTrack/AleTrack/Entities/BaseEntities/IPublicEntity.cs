namespace AleTrack.Entities.BaseEntities;

/// <summary>
/// Interface for DB entities which is to be referencable and identified in different applications
/// </summary>
public interface IPublicEntity
{
    /// <summary>
    /// GUID as a public identifier for cross application references
    /// </summary>
    public Guid PublicId { get; set; }
}