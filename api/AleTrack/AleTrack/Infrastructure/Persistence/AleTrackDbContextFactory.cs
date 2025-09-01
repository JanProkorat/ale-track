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
        if (connectionString is not null && connectionString.Contains("[YOUR-PASSWORD]"))
            connectionString = connectionString.AddPasswordToConnectionString();
        
        optionsBuilder.UseNpgsql(connectionString, npgsqlOptions =>
        {
            npgsqlOptions.EnableRetryOnFailure();
        });

        return new AleTrackDbContext(optionsBuilder.Options);
    }
}