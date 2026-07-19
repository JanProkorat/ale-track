using AleTrack.Common.Enums;

namespace AleTrack.Features.Users.Models;

/// <summary>
/// A single per-module access right for a user (used in user create/update/list).
/// A missing module (or <see cref="PermissionLevel.None"/>) means no access.
/// </summary>
public sealed record ModulePermissionDto
{
    /// <summary>The module the permission applies to.</summary>
    public ModuleType Module { get; set; }

    /// <summary>The granted access level.</summary>
    public PermissionLevel Level { get; set; }
}
