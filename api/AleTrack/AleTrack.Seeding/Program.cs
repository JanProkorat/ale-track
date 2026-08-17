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
            .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development"}.json", optional: true)
            // Re-added last so it outranks the JSON above. CreateDefaultBuilder already
            // installs an env-var source, but ConfigureAppConfiguration appends to that
            // list, so without this the JSON silently wins and
            // ConnectionStrings__AleTrack is ignored — leaving no way to point the
            // seeder at anything but its own appsettings.
            .AddEnvironmentVariables();
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
    var seeder = services.GetRequiredService<SeedingService>();

    // `dotnet run -- history [days]` tops up an already-seeded database with generated
    // history only, leaving its current-state fixtures alone. Anything else seeds from scratch.
    if (args.Length > 0 && args[0].Equals("history", StringComparison.OrdinalIgnoreCase))
    {
        var days = args.Length > 1 && int.TryParse(args[1], out var parsed) ? parsed : 208;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        Log.Information("History top-up started ({Days} days)", days);
        await seeder.InsertHistoryAsync(today.AddDays(-days), today.AddDays(-1));
        Log.Information("History top-up finished");
    }
    // `dotnet run -- sales [days]` tops up counter sales only, for the Garážový prodej reports.
    else if (args.Length > 0 && args[0].Equals("sales", StringComparison.OrdinalIgnoreCase))
    {
        var days = args.Length > 1 && int.TryParse(args[1], out var parsed) ? parsed : 208;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        Log.Information("Sales top-up started ({Days} days)", days);
        await seeder.InsertSalesHistoryAsync(today.AddDays(-days), today.AddDays(-1));
        Log.Information("Sales top-up finished");
    }
    else
    {
        Log.Information("Seeding started");
        await seeder.InsertDataAsync();
        Log.Information("Seeding finished");
    }
}
catch (Exception ex)
{
    Log.Error(ex, "Seeding error");
}

