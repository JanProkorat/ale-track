using AleTrack.Features.RoleCapabilities.Shared;

namespace AleTrack.Features.RoleCapabilities.Queries.List;

/// <summary>
/// The whole role capability table.
/// </summary>
public sealed record GetRoleCapabilitiesResponse
{
    /// <summary>The stored rows. Absence of a row for a role/key pair means visible (default-allow).</summary>
    public List<RoleCapabilityDto> Items { get; set; } = [];
}
