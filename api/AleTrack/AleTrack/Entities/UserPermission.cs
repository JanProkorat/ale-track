using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Granular per-module access right for a <see cref="User"/>. A user has at most
/// one row per <see cref="ModuleType"/>; the absence of a row means no access.
/// Admin-role users bypass these entirely (full access).
/// </summary>
[Table("user_permissions")]
public sealed class UserPermission : BaseEntity
{
    /// <summary>
    /// ID of the related <see cref="User"/>.
    /// </summary>
    [Column("user_id")]
    public long UserId { get; set; }

    /// <summary>
    /// The module this permission applies to.
    /// </summary>
    [Column("module")]
    public ModuleType Module { get; set; }

    /// <summary>
    /// The access level granted for the module.
    /// </summary>
    [Column("level")]
    public PermissionLevel Level { get; set; }

    /// <summary>
    /// The related <see cref="User"/> entity.
    /// </summary>
    public User User { get; set; } = null!;
}
