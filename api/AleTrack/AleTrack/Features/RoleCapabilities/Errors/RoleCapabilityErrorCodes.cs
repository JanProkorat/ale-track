namespace AleTrack.Features.RoleCapabilities.Errors;

/// <summary>
/// Stable error codes for the role capability slice; the frontend keys messages off them.
/// </summary>
public static class RoleCapabilityErrorCodes
{
    /// <summary>Admin always sees everything, so it cannot be configured.</summary>
    public const string AdminIsNotConfigurable = "RoleCapability.AdminIsNotConfigurable";

    /// <summary>A capability key is required and capped at 64 characters.</summary>
    public const string CapabilityKeyInvalid = "RoleCapability.CapabilityKeyInvalid";

    /// <summary>
    /// The same role/key pair (compared case-insensitively, matching how the read side folds
    /// keys) appears more than once in the payload.
    /// </summary>
    public const string DuplicateCapabilityKey = "RoleCapability.DuplicateCapabilityKey";
}
