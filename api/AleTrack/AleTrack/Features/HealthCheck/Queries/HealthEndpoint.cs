using FastEndpoints;

namespace AleTrack.Features.HealthCheck.Queries;

/// <summary>
/// HealthEndpoint provides a liveness endpoint for the application.
/// </summary>
/// <remarks>
/// Liveness answers whether the process is up and serving requests - nothing more.
/// It deliberately runs no dependency checks: a cold or briefly unreachable database
/// must not make the hosting platform consider a healthy instance dead. Use
/// <see cref="ReadyEndpoint"/> (/health/ready) to check dependencies.
/// Always returns 200 while the process can serve requests.
/// </remarks>
/// <example>
/// To access the liveness endpoint, send a GET request to the /health/live route.
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
        await Send.OkAsync(cancellation: ct);
    }
}