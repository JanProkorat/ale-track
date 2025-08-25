using FastEndpoints;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace AleTrack.Features.HealthCheck.Queries;

/// <summary>
/// HealthEndpoint provides a health check endpoint for the application.
/// </summary>
/// <remarks>
/// This endpoint is responsible for determining the application's health status.
/// It provides a lightweight response indicating whether the application is healthy.
/// A GET request to the /health/live path will trigger the health check process.
/// Appropriate HTTP status codes are returned based on the health status:
/// - 200 (Healthy)
/// - 503 (Unhealthy)
/// </remarks>
/// <example>
/// To access the health check endpoint, send a GET request to the /health/live route.
/// This endpoint is configured to allow anonymous access.
/// </example>
public class HealthEndpoint : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/health/live");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        await HttpContext
            .RequestServices
            .GetRequiredService<HealthCheckService>()
            .CheckHealthAsync(ct)
            .ContinueWith(async result =>
            {
                var response = result.Result;
                HttpContext.Response.StatusCode =
                    response.Status == HealthStatus.Healthy ? 200 : 503;
                await HttpContext.Response.WriteAsJsonAsync(response, ct);
            }, ct);
    }
}