namespace AleTrack.Common.Enums;

/// <summary>
/// Level of access a user has to a given <see cref="ModuleType"/>.
/// Ordered so a higher value implies the lower ones (Edit implies View).
/// </summary>
public enum PermissionLevel
{
    /// <summary>No access to the module.</summary>
    None = 0,

    /// <summary>Read-only access.</summary>
    View = 1,

    /// <summary>Full read/write access.</summary>
    Edit = 2
}
