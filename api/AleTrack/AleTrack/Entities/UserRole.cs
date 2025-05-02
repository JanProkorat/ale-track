using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Represents the role assigned to a user within the system.
/// Contains mappings to the "user_roles" table and includes details such as the associated user ID,
/// role type, and related user entity.
/// </summary>
[Table("user_roles")]
public sealed class UserRole : BaseEntity
{
    /// <summary>
    /// ID of related <see cref="User"/>
    /// </summary>
    [Column("user_id")]
    public long UserId { get; set; }

    /// <summary>
    /// The role type associated with the user, defining the user's role within the system.
    /// </summary>
    [Column("type")]
    public UserRoleType Type { get; set; }
    
    /// <summary>
    /// Represents the related <see cref="User"/> entity.
    /// </summary>
    public User User { get; set; } = null!;
}