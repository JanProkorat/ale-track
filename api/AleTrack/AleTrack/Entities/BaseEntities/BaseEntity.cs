using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities.BaseEntities;

/// <summary>
/// Base entity which should be derived from every entity in module
/// </summary>
[PrimaryKey(nameof(Id))]
public class BaseEntity
{
    protected BaseEntity()
    {}
    
    /// <summary>
    /// Primary key ID 
    /// </summary>
    [Column("id")]
    public long Id { get; set; }
}