using AleTrack.Common.Enums;
using AleTrack.Features.RoleCapabilities.Shared;

namespace AleTrack.Features.RoleCapabilities.Queries.List;

/// <summary>
/// The whole role capability table.
/// </summary>
public sealed record GetRoleCapabilitiesResponse
{
    /// <summary>The stored rows. Absence of a row for a role/key pair means visible (default-allow).</summary>
    public List<RoleCapabilityDto> Items { get; set; } = [];

    /// <summary>
    /// Every capability key the backend enforces, so the editor can render a row for a
    /// data-guarding capability that has no saved override yet. Also the mechanism by which
    /// <see cref="Capability"/> crosses the OpenAPI boundary, so the generated client exposes
    /// it for the frontend registry drift test to check against.
    /// </summary>
    public List<Capability> AvailableCapabilities { get; set; } = [.. Enum.GetValues<Capability>()];
}
