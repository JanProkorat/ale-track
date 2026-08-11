using AleTrack.Common.Enums;

namespace AleTrack.Common.Authorization;

/// <summary>
/// The authoritative role → <see cref="Capability"/> table. Stored as denials because
/// every role allows everything by default; only a restricted persona subtracts.
/// The frontend keeps a mirror of this table for chrome, but this one decides.
/// </summary>
public static class RoleCapabilities
{
    /// <summary>
    /// Capabilities each role is denied. A role absent from this map is denied nothing.
    /// </summary>
    private static readonly Dictionary<UserRoleType, Capability[]> DeniedByRole = new()
    {
        [UserRoleType.Driver] = [Capability.Invoicing, Capability.LoadingBreakdown, Capability.Money]
    };

    /// <summary>
    /// Whether <paramref name="role"/> is denied <paramref name="capability"/>.
    /// </summary>
    public static bool Denies(UserRoleType role, Capability capability) =>
        DeniedByRole.TryGetValue(role, out var denied) && denied.Contains(capability);
}
