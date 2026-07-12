using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities.BaseEntities;
/// <summary>
/// Abstraction for entities which should be identified outside the application
/// </summary>
[Index(nameof(PublicId), IsUnique = true)]
public class PublicEntity : BaseEntity, IPublicEntity
{
    protected PublicEntity()
    { }
    
    /// <inheritdoc />
    [Column("public_id")]
    public Guid PublicId { get; set; }
}