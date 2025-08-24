using System.Collections;
using System.Configuration;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Converters;
using AleTrack.Infrastructure.Interceptors.PublicEntity;
using AleTrack.Infrastructure.Interceptors.SaveChangesCombine;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using FastEndpoints.Swagger;
using FluentValidation;
using Microsoft.AspNetCore.Http.Json;
using Serilog;
using Serilog.Events;
using Serilog.Extensions.Logging;
using Serilog.Sinks.SystemConsole.Themes;
using Microsoft.EntityFrameworkCore;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Information)
    .Enrich.FromLogContext()
    .WriteTo.Console(theme: AnsiConsoleTheme.Code)
    .CreateBootstrapLogger();

try
{
    Console.WriteLine($"Raw ENV var: {Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")}");
    Console.WriteLine($"All ENV vars containing 'ENV': ");
    foreach (DictionaryEntry env in Environment.GetEnvironmentVariables())
    {
        if (env.Key.ToString().Contains("ENV"))
            Console.WriteLine($"  {env.Key} = {env.Value}");
    }
    
    var builder = WebApplication.CreateBuilder(args);
    var configuration = builder.Configuration;
    
    Log.Information("Starting web host AleTrack");
    
    
    var services = builder.Services;

    var assembly = Assembly.GetExecutingAssembly();
    
    builder.Host.UseSerilog((context, config) => config
        .ReadFrom.Configuration(context.Configuration));
    
    var connectionString = configuration.GetConnectionString("AleTrack");
    if (string.IsNullOrWhiteSpace(connectionString))
        throw new ConfigurationErrorsException($"DB Connection string as configured property named 'ConnectionStrings:{connectionString}' is missing");
    
    services.Configure<JsonOptions>(options =>
    {
        options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.SerializerOptions.Converters.Add(new UtcDateTimeConverter());
    });

    services.AddEndpointsApiExplorer();
    
    services.AddMemoryCache();
    services.AddHttpClient();
    services.AddHttpContextAccessor();

    services.AddFastEndpoints()
        .SwaggerDocument(o =>
        {
            o.DocumentSettings = s =>
            {
                s.Title = "AleTrack API";
                s.Version = "v1";
                s.OperationProcessors.Add(new FilterableQueryProcessor());
                s.OperationProcessors.Add(new BadRequestResponseProcessor());
                
            };
            o.ShortSchemaNames = true;
            o.SerializerSettings = s =>
            {
                s.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            };
        })
        .AddValidatorsFromAssembly(assembly, ServiceLifetime.Singleton);

    services.AddDbContext<AleTrackDbContext>(options =>
    {
        options
            .UseLoggerFactory(new SerilogLoggerFactory())
            .UseSqlite(connectionString)
            .UseSnakeCaseNamingConvention()
            .UseCombineOf(new PublicEntityInterceptor());
        
        options.EnableDetailedErrors();
        options.EnableSensitiveDataLogging();
    });

    // Health checks registration
    services.AddHealthChecks()
        .AddDbContextCheck<AleTrackDbContext>("Database");
    
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
            policy.WithOrigins("http://localhost:3039")
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        });
    });
    
    var application = builder.Build();
    Log.Information("Successfully building up application");

    // Map health checks endpoints before authentication/authorization middlewares
    application.MapHealthChecks("/health/live");
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
