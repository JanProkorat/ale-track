using AleTrack.Features.RoleCapabilities.Shared;

namespace AleTrack.Features.RoleCapabilities.Commands.Set;

/// <summary>
/// A full replacement of the role capability table.
/// </summary>
public sealed record SetRoleCapabilitiesDto
{
    /// <summary>
    /// The rows to persist. Any row not present is deleted; the table always ends up
    /// containing exactly these rows.
    /// </summary>
    public List<RoleCapabilityDto> Items { get; set; } = [];
}
