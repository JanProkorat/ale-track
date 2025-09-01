using AleTrack.ExchangeRateDownloader;
using Microsoft.Extensions.Configuration;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
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
            .AddJsonFile("../AleTrack/appsettings.json", optional: false, reloadOnChange: true)
            .AddJsonFile($"../AleTrack/appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development"}.json", optional: true);

    })
    .ConfigureServices((context, services) =>
    {
        // Add DB context
        var connectionString = context.Configuration.GetConnectionString("AleTrack");
        if (connectionString is not null && connectionString.Contains("[YOUR-PASSWORD]"))
            connectionString = connectionString.AddPasswordToConnectionString();
        
        services.AddDbContext<AleTrackDbContext>(options =>
            options.UseNpgsql(connectionString));

        // Add fetching service
        services.AddHttpClient();
        services.AddTransient<ExchangeRateService>();
    })
    .UseSerilog((context, config) => config.ReadFrom.Configuration(context.Configuration))
    .Build();

using var scope = host.Services.CreateScope();
var services = scope.ServiceProvider;

try
{
    Log.Information("Downloading started");
    var seeder = services.GetRequiredService<ExchangeRateService>();
    await seeder.GetCurrentRateAsync();
    Log.Information("Downloading finished");
}
catch (Exception ex)
{
    Log.Error(ex, "Downloading error");
}