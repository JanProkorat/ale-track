using AleTrack.Common.Enums;

namespace AleTrack.Features.RoleCapabilities.Shared;

/// <summary>
/// Visibility of one capability for one role.
/// </summary>
public sealed record RoleCapabilityDto
{
    /// <summary>The role the row applies to.</summary>
    public UserRoleType Role { get; set; }

    /// <summary>Key of the capability.</summary>
    public string CapabilityKey { get; set; } = null!;

    /// <summary>Whether the role may see it.</summary>
    public bool IsVisible { get; set; }
}
