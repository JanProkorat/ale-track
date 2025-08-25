using FastEndpoints;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace AleTrack.Features.HealthCheck.Queries;

public class ReadyEndpoint : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/health/ready");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var healthService = HttpContext.RequestServices.GetRequiredService<HealthCheckService>();
        var result = await healthService.CheckHealthAsync(ct);

        HttpContext.Response.StatusCode =
            result.Status == HealthStatus.Healthy ? 200 : 503;
        await HttpContext.Response.WriteAsJsonAsync(result, ct);
    }
}