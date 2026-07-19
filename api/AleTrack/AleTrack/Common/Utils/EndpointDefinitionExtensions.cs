using AleTrack.Common.Authorization;
using AleTrack.Common.Enums;
using AleTrack.Common.Models;

namespace AleTrack.Common.Utils;

/// <summary>
/// Extension to add params to endpoint definition
/// </summary>
public static class EndpointDefinitionExtensions
{
    /// <summary>
    /// Extension to add auth level authorization
    /// </summary>
    /// <param name="builder"></param>
    /// <param name="roleType"></param>
    /// <returns></returns>
    public static RouteHandlerBuilder RequireRole(this RouteHandlerBuilder builder, UserRoleType roleType)
    {
        builder.RequireAuthorization(roleType.ToString());
        builder.Produces<FailureResponse>(StatusCodes.Status403Forbidden);
        builder.Produces<FailureResponse>(StatusCodes.Status401Unauthorized);

        return builder;
    }

    /// <summary>
    /// Requires the caller to have at least <paramref name="minLevel"/> access to
    /// <paramref name="module"/> (Admins always pass). Use View for reads, Edit for writes.
    /// </summary>
    public static RouteHandlerBuilder RequirePermission(this RouteHandlerBuilder builder, ModuleType module, PermissionLevel minLevel)
    {
        builder.RequireAuthorization(ModulePermissionRequirement.PolicyName(module, minLevel));
        builder.Produces<FailureResponse>(StatusCodes.Status403Forbidden);
        builder.Produces<FailureResponse>(StatusCodes.Status401Unauthorized);

        return builder;
    }

    /// <summary>
    /// Requires only an authenticated user (no specific module), for cross-cutting
    /// reference endpoints (exchange rates, master data, reports, dashboard reminders).
    /// </summary>
    public static RouteHandlerBuilder RequireAuthenticated(this RouteHandlerBuilder builder)
    {
        builder.RequireAuthorization();
        builder.Produces<FailureResponse>(StatusCodes.Status403Forbidden);
        builder.Produces<FailureResponse>(StatusCodes.Status401Unauthorized);

        return builder;
    }
}