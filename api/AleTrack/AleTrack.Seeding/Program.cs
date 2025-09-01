
using System.Configuration;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Seeding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.SystemConsole.Themes;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Information)
    .Enrich.FromLogContext()
    .WriteTo.Console(theme: AnsiConsoleTheme.Code)
    .CreateBootstrapLogger();

var host = Host.CreateDefaultBuilder(args)
    .ConfigureAppConfiguration((_, config) =>
    {
        config
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development"}.json", optional: true);

    })
    .ConfigureServices((context, services) =>
    {
        // Add DB context
        var connectionString = context.Configuration.GetConnectionString("AleTrack");
        if (connectionString is not null && connectionString.Contains("[YOUR-PASSWORD]"))
            connectionString = connectionString.AddPasswordToConnectionString();
        
        services.AddDbContext<AleTrackDbContext>(options =>
            options.UseNpgsql(connectionString));

        // Add seeding service
        services.AddTransient<SeedingService>();
    })
    .Build();
    
// Start seeding
using var scope = host.Services.CreateScope();
var services = scope.ServiceProvider;

try
{
    Log.Information("Seeding started");
    var seeder = services.GetRequiredService<SeedingService>();
    await seeder.InsertDataAsync();
    Log.Information("Seeding finished");
}
catch (Exception ex)
{
    Log.Error(ex, "Seeding error");
}

