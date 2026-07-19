using AleTrack.Common.Enums;
using Microsoft.AspNetCore.Authorization;

namespace AleTrack.Common.Authorization;

/// <summary>
/// Authorization requirement satisfied when the caller has at least
/// <see cref="MinLevel"/> access to <see cref="Module"/> (or is an Admin).
/// </summary>
public sealed class ModulePermissionRequirement(ModuleType module, PermissionLevel minLevel) : IAuthorizationRequirement
{
    /// <summary>The module the access is checked against.</summary>
    public ModuleType Module { get; } = module;

    /// <summary>The minimum level required (View or Edit).</summary>
    public PermissionLevel MinLevel { get; } = minLevel;

    /// <summary>Policy name for a (module, level) pair, e.g. "Orders:Edit".</summary>
    public static string PolicyName(ModuleType module, PermissionLevel level) => $"{module}:{level}";
}
