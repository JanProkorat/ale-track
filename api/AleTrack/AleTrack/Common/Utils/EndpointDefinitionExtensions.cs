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
}