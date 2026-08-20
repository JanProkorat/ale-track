using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using Microsoft.AspNetCore.Authorization;

namespace AleTrack.Common.Authorization;

/// <summary>
/// Grants access when the caller is an Admin, or holds a per-module permission
/// claim for the required module at or above the required level.
/// </summary>
public sealed class ModulePermissionHandler : AuthorizationHandler<ModulePermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ModulePermissionRequirement requirement)
    {
        // Admin role bypasses granular permissions entirely.
        if (context.User.IsInRole(nameof(UserRoleType.Admin)))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var prefix = $"{requirement.Module}:";
        foreach (var claim in context.User.FindAll(JwtService.PermissionClaimType))
        {
            if (!claim.Value.StartsWith(prefix, StringComparison.Ordinal))
                continue;

            var raw = claim.Value[prefix.Length..];
            if (Enum.TryParse<PermissionLevel>(raw, out var level) && level >= requirement.MinLevel)
            {
                context.Succeed(requirement);
                break;
            }
        }

        return Task.CompletedTask;
    }
}
