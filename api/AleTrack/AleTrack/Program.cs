using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Converters;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using FastEndpoints.Swagger;
using FluentValidation;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.SystemConsole.Themes;
using AppContext = AleTrack.Common.Utils.AppContext;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Information)
    .Enrich.FromLogContext()
    .WriteTo.Console(theme: AnsiConsoleTheme.Code)
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    var configuration = builder.Configuration;
    
    Log.Information("Starting web host AleTrack");
    
    var services = builder.Services;

    var assembly = Assembly.GetExecutingAssembly();
    
    builder.Host.UseSerilog((context, config) => config
        .ReadFrom.Configuration(context.Configuration));
    
    var connectionString = configuration.GetConnectionString(builder.Environment);
    
    services.Configure<JsonOptions>(options =>
    {
        options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.SerializerOptions.Converters.Add(new UtcDateTimeConverter());
    });
    
    services.AddEndpointsApiExplorer();
    
    services.AddMemoryCache();
    services.AddHttpClient();
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<IAppContext, AppContext>();
    
    services.AddFastEndpoints()
        .SwaggerDocument(o =>
        {
            o.DocumentSettings = s =>
            {
                s.Title = "AleTrack API";
                s.Version = "v1";
                s.OperationProcessors.Add(new FilterableQueryProcessor());
                s.OperationProcessors.Add(new BadRequestResponseProcessor());
                s.OperationProcessors.Add(new BinaryResponseProcessor());

            };
            o.ShortSchemaNames = true;
            o.SerializerSettings = s =>
            {
                s.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            };
        })
        .AddValidatorsFromAssembly(assembly, ServiceLifetime.Singleton);

    // Detailed errors and sensitive data logging write query parameter values into the log.
    // Development.Local is the only environment that targets a developer's own database;
    // every other one (including Development, which points at the shared remote DB) keeps them off.
    services.CreateDbContext(connectionString, builder.Environment.IsEnvironment("Development.Local"));

    // Health checks registration. The database check is tagged so that it can be excluded
    // from liveness - see the endpoint mapping below.
    services.AddHealthChecks()
        .AddDbContextCheck<AleTrackDbContext>("Database", tags: ["ready"]);

    // Bound every check, so an unreachable dependency reports Unhealthy instead of
    // blocking the request until the caller gives up. The first connection after a cold
    // start was measured at ~9.9s against the remote database, so keep enough headroom
    // that a slow cold connect does not flap readiness to Unhealthy.
    services.Configure<HealthCheckServiceOptions>(options =>
    {
        foreach (var registration in options.Registrations)
            registration.Timeout = TimeSpan.FromSeconds(20);
    });
    
    // Add JWT Service
    services.AddScoped<IJwtService, JwtService>();
    services.AddSingleton<IPasswordHasher, PasswordHasher>();

    // Add JWT Authentication using the extension method
    services.AddJwtAuthentication(builder.Configuration);

    // Add user Authorization
    services.AddUserAuthorization();
    
    services.AddCors(options =>
    {
        options.AddPolicy("AllowFrontend", policy =>
        {
            policy.WithOrigins(
                    "https://dev--ale-track.netlify.app",
                    "https://ale-track.netlify.app",
                    "http://localhost:3039",
                    "https://scaling-adventure-qv5v9p77grq269p-3039.app.github.dev"
                )
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        });
    });
    
    var application = builder.Build();
    
    Log.Information("Successfully building up application");

    // await application.ApplyMigrationsAsync();
    
    // Map health checks endpoints before authentication/authorization middlewares.
    // Liveness runs no checks on purpose: it answers 200 as soon as Kestrel is listening.
    // Including the database check here makes the platform kill a perfectly healthy
    // instance whenever the database is cold or briefly unreachable.
    application.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
    application.MapHealthChecks("/health/ready");
    
    if (application.Environment.IsProduction())
        application.UseHsts();

    application.UseCors("AllowFrontend");
    application.UseRouting();

    application.UseAuthentication();
    application.UseAuthorization();
    application.UseOpenApi();

    application
        .UseFastEndpoints(c =>
        {
            c.Endpoints.RoutePrefix = "ale-track";
            c.Binding.Modifier = (request, _, binderContext, _) =>
            {
                if (request is FilterableRequest filterableRequest)
                {
                    filterableRequest.Parameters = binderContext.HttpContext
                        .Request
                        .Query
                        .ToDictionary(k => k.Key, v => v.Value.ToString());
                }

                c.Versioning.Prefix = "v";
                c.Versioning.DefaultVersion = 1;
                c.Versioning.PrependToRoute = true;
            };
        })
        .UseAleTrackExceptionHandler(Log.Logger)
        .UseSwaggerGen();
    
    Log.Information("Successfully setting up application middlewares");
    
    Log.Information("Running up the application");
    await application.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "An unhandled exception occured during bootstrapping");
}
finally
{
    Log.Information("Shutting down the application");
    await Log.CloseAndFlushAsync();
}
