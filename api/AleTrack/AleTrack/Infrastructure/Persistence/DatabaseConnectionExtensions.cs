using System.Configuration;
using AleTrack.Infrastructure.Interceptors.PublicEntity;
using AleTrack.Infrastructure.Interceptors.SaveChangesCombine;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace AleTrack.Infrastructure.Persistence;

/// <summary>
/// Provides extension methods for database connection-related operations,
/// including retrieving connection strings and applying migrations.
/// </summary>
public static class DatabaseConnectionExtensions
{
    /// <summary>
    /// Retrieves the database connection string from the configuration,
    /// replacing placeholders with appropriate environment-specific values.
    /// </summary>
    /// <param name="configuration">
    /// The application configuration object that provides access to configuration settings.
    /// </param>
    /// <param name="environment">
    /// The hosting environment information, used to determine the current environment.
    /// </param>
    /// <returns>
    /// The complete and validated database connection string suitable for the current environment.
    /// </returns>
    /// <exception cref="ConfigurationErrorsException">
    /// Thrown when the required configuration settings or environment variables
    /// for constructing the connection string are missing or invalid.
    /// </exception>
    public static string GetConnectionString(this IConfiguration configuration, IWebHostEnvironment environment)
    {
        var connectionString = configuration.GetConnectionString("AleTrack");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new ConfigurationErrorsException($"DB Connection string as configured property named 'ConnectionStrings:AleTrack' is missing");

        // If not Development.Local, replace [YOUR-PASSWORD] in connection string with DB_PASSWORD from config/env
        var environmentName = environment.EnvironmentName;
        if (string.Equals(environmentName, "Development.Local", StringComparison.OrdinalIgnoreCase)) 
            return connectionString;
        
        var dbPassword = configuration["DB_PASSWORD"];
        if (string.IsNullOrWhiteSpace(dbPassword))
            throw new ConfigurationErrorsException("DB_PASSWORD environment variable/configuration is missing.");
            
        connectionString = connectionString.Replace("[YOUR-PASSWORD]", dbPassword);

        return connectionString;
    }

    /// <summary>
    /// Applies any pending migrations to the application's database during runtime.
    /// Ensures that the database schema is up to date with the current application's data model.
    /// </summary>
    /// <param name="application">
    /// The current web application instance, used to resolve the necessary services and database context.
    /// </param>
    /// <returns>
    /// A task representing the asynchronous operation of applying migrations.
    /// </returns>
    /// <exception cref="InvalidOperationException">
    /// Thrown if the database context cannot be resolved from the application's service provider.
    /// </exception>
    public static async Task ApplyMigrationsAsync(this WebApplication application)
    {
        using var scope = application.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AleTrackDbContext>();
    
        Log.Information("Checking for pending database migrations...");
    
        var pendingMigrations = (await dbContext.Database.GetPendingMigrationsAsync()).ToList();
        if (pendingMigrations.Count > 0)
        {
            Log.Information("Applying {Count} pending migrations", pendingMigrations.Count());
            await dbContext.Database.MigrateAsync();
            Log.Information("Database migrations applied successfully");
        }
        else
        {
            Log.Information("No pending migrations found");
        }
    }

    /// <summary>
    /// Configures the application's DbContext for dependency injection, setting up
    /// database connection, retry policies, naming conventions, and interceptors.
    /// </summary>
    /// <param name="services">
    /// The IServiceCollection to which the DbContext will be added, enabling dependency injection.
    /// </param>
    /// <param name="connectionString">
    /// The database connection string used to connect to the specified database server.
    /// </param>
    public static void CreateDbContext(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<AleTrackDbContext>(options =>
        {
            options.UseNpgsql(connectionString, npgsqlOptions =>
            {
                npgsqlOptions.EnableRetryOnFailure();
            });
            
            options.UseCombineOf(new PublicEntityInterceptor());
            options.EnableDetailedErrors();
            options.EnableSensitiveDataLogging();
        });
    }
}