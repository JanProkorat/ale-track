using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace AleTrack.Infrastructure.Persistance;

public class AleTrackDbContextFactory : IDesignTimeDbContextFactory<AleTrackDbContext>
{
    public AleTrackDbContext CreateDbContext(string[] args)
    {
        IConfigurationRoot configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json")
            .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development"}.json", optional: true)
            .Build();

        var builder = new DbContextOptionsBuilder<AleTrackDbContext>();
        var connectionString = configuration.GetConnectionString("AleTrack");
            
        builder.UseSqlite(connectionString);

        return new AleTrackDbContext(builder.Options);
    }
}