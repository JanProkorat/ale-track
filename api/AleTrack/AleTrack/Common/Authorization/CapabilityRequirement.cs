using AleTrack.Common.Enums;
using Microsoft.AspNetCore.Authorization;

namespace AleTrack.Common.Authorization;

/// <summary>
/// Authorization requirement satisfied when none of the caller's roles denies
/// <see cref="Capability"/> (Admins always pass). Composes with
/// <see cref="ModulePermissionRequirement"/>: the module permission grants access to
/// the endpoint, the capability decides whether this part of it is visible.
/// </summary>
public sealed class CapabilityRequirement(Capability capability) : IAuthorizationRequirement
{
    /// <summary>The capability the caller must not be denied.</summary>
    public Capability Capability { get; } = capability;

    /// <summary>Policy name for a capability, e.g. "cap:Invoicing".</summary>
    public static string PolicyName(Capability capability) => $"cap:{capability}";
}
