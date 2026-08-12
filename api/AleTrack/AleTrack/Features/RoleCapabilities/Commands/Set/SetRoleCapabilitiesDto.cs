using AleTrack.Features.RoleCapabilities.Shared;

namespace AleTrack.Features.RoleCapabilities.Commands.Set;

/// <summary>
/// A targeted replacement of the role capability table: only the (role, capability key) pairs
/// named below are affected.
/// </summary>
public sealed record SetRoleCapabilitiesDto
{
    /// <summary>
    /// The rows to persist. Each row replaces any existing row sharing its (role, capability
    /// key) pair (matched case-insensitively); a stored row for a pair not named here is left
    /// untouched, not deleted.
    /// </summary>
    public List<RoleCapabilityDto> Items { get; set; } = [];
}
