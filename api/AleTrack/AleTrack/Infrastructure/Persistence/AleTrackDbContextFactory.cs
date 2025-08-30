using System.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace AleTrack.Infrastructure.Persistence;

public class AleTrackDbContextFactory : IDesignTimeDbContextFactory<AleTrackDbContext>
{
    public AleTrackDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AleTrackDbContext>();

        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json")
            .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development"}.json", optional: true)
            .Build();

        var connectionString = configuration.GetConnectionString("AleTrack");
        var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD");
        
        if (string.IsNullOrWhiteSpace(dbPassword))
            throw new ConfigurationErrorsException("DB_PASSWORD environment variable/configuration is missing.");
            
        connectionString = connectionString!.Replace("[YOUR-PASSWORD]", dbPassword);
        
        optionsBuilder.UseNpgsql(connectionString, npgsqlOptions =>
        {
            npgsqlOptions.EnableRetryOnFailure();
        });

        return new AleTrackDbContext(optionsBuilder.Options);
    }
}