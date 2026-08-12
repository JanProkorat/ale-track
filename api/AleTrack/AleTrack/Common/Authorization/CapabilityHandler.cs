using AleTrack.Common.Enums;
using Microsoft.AspNetCore.Authorization;

namespace AleTrack.Common.Authorization;

/// <summary>
/// Grants a <see cref="CapabilityRequirement"/> unless one of the caller's roles is denied the
/// capability by <see cref="RoleCapabilityPolicy"/>. Admin short-circuits to allowed; otherwise
/// the rule is deny-if-any-denies, so an account carrying a restricted role alongside another
/// lands on the restrictive answer.
/// </summary>
public sealed class CapabilityHandler(RoleCapabilityPolicy policy)
    : AuthorizationHandler<CapabilityRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        CapabilityRequirement requirement)
    {
        if (context.User.IsInRole(nameof(UserRoleType.Admin)))
        {
            context.Succeed(requirement);
            return;
        }

        var key = requirement.Capability.ToString();

        foreach (var role in Enum.GetValues<UserRoleType>())
        {
            if (!context.User.IsInRole(role.ToString()))
            {
                continue;
            }

            // AuthorizationHandlerContext carries no CancellationToken; the read is cached
            // and in-process, so there is nothing to cancel.
            var hidden = await policy.GetHiddenKeysAsync(role, CancellationToken.None);

            if (hidden.Contains(key))
            {
                context.Fail();
                return;
            }
        }

        context.Succeed(requirement);
    }
}
