using System.Text;
using AleTrack.Common.Enums;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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
        services.AddAuthorizationBuilder()
            .AddPolicy(UserRoleType.Admin.ToString(), policy => policy.RequireRole(UserRoleType.Admin.ToString()))
            .AddPolicy(UserRoleType.User.ToString(), policy => 
                policy.RequireRole(UserRoleType.User.ToString(), UserRoleType.Admin.ToString()));

        return services;
    }

}