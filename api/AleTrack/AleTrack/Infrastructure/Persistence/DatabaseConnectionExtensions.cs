using System.Configuration;
using AleTrack.Infrastructure.Interceptors.PublicEntity;
using AleTrack.Infrastructure.Interceptors.SaveChangesCombine;
using Microsoft.EntityFrameworkCore;
using Npgsql;
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

        if (connectionString.Contains("[YOUR-PASSWORD]"))
            connectionString = connectionString.AddPasswordToConnectionString();

        return connectionString;
    }

    /// <summary>
    /// Adds the pool-liveness settings Npgsql leaves off by default, unless the connection
    /// string already sets them.
    /// </summary>
    /// <remarks>
    /// Without these the pool can hand out a socket the server has already closed. Supabase's
    /// pooler drops idle connections well inside Npgsql's 300-second default
    /// <c>Connection Idle Lifetime</c>, and with <c>Keepalive</c> off by default nothing keeps
    /// the connection alive or notices it died. The next command then fails on the first read
    /// — on macOS as <c>SocketException (22): Invalid argument</c> out of
    /// <c>NpgsqlReadBuffer.set_Timeout</c>, because setting a receive timeout on a dead socket
    /// returns EINVAL.
    ///
    /// Retrying does not cover this: the socket error is raised before Npgsql can wrap it as a
    /// transient <c>NpgsqlException</c>, so <c>EnableRetryOnFailure</c> never sees anything it
    /// recognises. Keeping the connection alive, and dropping it early if it went idle, is what
    /// actually prevents it.
    ///
    /// Anything already spelled out in the connection string wins — this only fills in defaults.
    /// </remarks>
    public static string WithPoolLivenessDefaults(this string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);

        // Keys the caller actually wrote. NpgsqlConnectionStringBuilder.ContainsKey answers
        // "is this a known keyword", which is true for every one of these whether set or not.
        var configured = connectionString
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(pair => pair.Split('=', 2)[0].Replace(" ", string.Empty))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Well inside the idle window of every pooler we run against.
        if (!configured.Contains("Keepalive"))
            builder.KeepAlive = 30;

        // Prune before the far end does, so a stale connection is never reused.
        if (!configured.Contains("ConnectionIdleLifetime"))
            builder.ConnectionIdleLifetime = 60;

        if (!configured.Contains("TcpKeepalive"))
            builder.TcpKeepAlive = true;

        return builder.ConnectionString;
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
    /// <param name="enableSensitiveDataLogging">
    /// When true, enables detailed errors and sensitive data logging. These write query
    /// parameter values into the log, so they must stay off outside local development.
    /// </param>
    public static void CreateDbContext(this IServiceCollection services, string connectionString, bool enableSensitiveDataLogging)
    {
        services.AddDbContext<AleTrackDbContext>(options =>
        {
            options.UseNpgsql(connectionString.WithPoolLivenessDefaults(), npgsqlOptions =>
            {
                // Covers the stock transient errors plus a connection that died in the pool.
                npgsqlOptions.ExecutionStrategy(dependencies => new BrokenConnectionRetryStrategy(dependencies));
            });

            options.UseCombineOf(new PublicEntityInterceptor());

            if (!enableSensitiveDataLogging)
                return;

            options.EnableDetailedErrors();
            options.EnableSensitiveDataLogging();
        });
    }
    
    public static string AddPasswordToConnectionString(this string connectionString)
    {
        var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD");
        
        if (string.IsNullOrWhiteSpace(dbPassword))
            throw new ConfigurationErrorsException("DB_PASSWORD environment variable/configuration is missing.");
            
        connectionString = connectionString.Replace("[YOUR-PASSWORD]", dbPassword);
        
        return connectionString;
    }
}