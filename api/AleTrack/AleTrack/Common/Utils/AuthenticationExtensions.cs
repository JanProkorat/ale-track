using System.Text;
using AleTrack.Common.Authorization;
using AleTrack.Common.Enums;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;

namespace AleTrack.Common.Utils;

public static class AuthenticationExtensions
{
    /// <summary>
    /// Configures JWT-based authentication for the application.
    /// </summary>
    /// <param name="services">The collection of service descriptors to add authentication services to.</param>
    /// <param name="configuration">The application configuration containing JWT settings such as issuer and key.</param>
    /// <returns>The updated IServiceCollection with authentication services configured.</returns>
    public static IServiceCollection AddJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = configuration["JWT_Issuer"],
                    IssuerSigningKey = new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(configuration["JWT_Key"]))
                };
            });

        return services;
    }

    /// <summary>
    /// Configures authorization policies for the application based on user roles.
    /// </summary>
    /// <param name="services">The collection of service descriptors to add authorization services to.</param>
    /// <returns>The updated IServiceCollection with authorization policies configured.</returns>
    public static IServiceCollection AddUserAuthorization(this IServiceCollection services)
    {
        services.AddSingleton<IAuthorizationHandler, ModulePermissionHandler>();
        services.AddScoped<RoleCapabilityPolicy>();
        services.AddScoped<IAuthorizationHandler, CapabilityHandler>();

        var builder = services.AddAuthorizationBuilder()
            .AddPolicy(nameof(UserRoleType.Admin), policy => policy.RequireRole(nameof(UserRoleType.Admin)))
            .AddPolicy(nameof(UserRoleType.Manager), policy =>
                policy.RequireRole(nameof(UserRoleType.Manager), nameof(UserRoleType.Admin)));

        // One policy per (module, level) — the gate used by every feature endpoint.
        foreach (var module in Enum.GetValues<ModuleType>())
        {
            foreach (var level in new[] { PermissionLevel.View, PermissionLevel.Edit })
            {
                builder.AddPolicy(
                    ModulePermissionRequirement.PolicyName(module, level),
                    policy => policy.AddRequirements(new ModulePermissionRequirement(module, level)));
            }
        }

        // One policy per capability, ANDed with the module policy on the endpoints that
        // expose restricted content.
        foreach (var capability in Enum.GetValues<Capability>())
        {
            builder.AddPolicy(
                CapabilityRequirement.PolicyName(capability),
                policy => policy
                    .RequireAuthenticatedUser()
                    .AddRequirements(new CapabilityRequirement(capability)));
        }

        return services;
    }

}