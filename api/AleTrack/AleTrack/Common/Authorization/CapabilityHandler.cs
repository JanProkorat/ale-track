using AleTrack.Common.Enums;
using Microsoft.AspNetCore.Authorization;

namespace AleTrack.Common.Authorization;

/// <summary>
/// Grants a <see cref="CapabilityRequirement"/> unless one of the caller's roles denies
/// the capability. Admin short-circuits to allowed; otherwise the rule is
/// deny-if-any-denies, so an account carrying a restricted role alongside another one
/// lands on the restrictive answer rather than the permissive one.
/// </summary>
public sealed class CapabilityHandler : AuthorizationHandler<CapabilityRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        CapabilityRequirement requirement)
    {
        if (context.User.IsInRole(nameof(UserRoleType.Admin)))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        foreach (var role in Enum.GetValues<UserRoleType>())
        {
            if (context.User.IsInRole(role.ToString()) && RoleCapabilities.Denies(role, requirement.Capability))
            {
                context.Fail();
                return Task.CompletedTask;
            }
        }

        context.Succeed(requirement);
        return Task.CompletedTask;
    }
}
