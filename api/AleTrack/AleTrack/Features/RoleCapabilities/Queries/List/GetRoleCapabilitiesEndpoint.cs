using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.RoleCapabilities.Shared;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.RoleCapabilities.Queries.List;

/// <summary>
/// Endpoint returning the whole role capability table, for the admin editor screen.
/// </summary>
/// <param name="dbContext"></param>
public sealed class GetRoleCapabilitiesEndpoint(AleTrackDbContext dbContext)
    : EndpointWithoutRequest<GetRoleCapabilitiesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("role-capabilities");
        Description(b => b
            .RequirePermission(ModuleType.Users, PermissionLevel.View)
            .WithName(nameof(GetRoleCapabilitiesEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets which components each role may see";
            s.Responses[StatusCodes.Status200OK] = "Role capability table";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var items = await dbContext.RoleCapabilities
            .AsNoTracking()
            .Select(x => new RoleCapabilityDto
            {
                Role = x.Role,
                CapabilityKey = x.CapabilityKey,
                IsVisible = x.IsVisible
            })
            .ToListAsync(ct);

        await Send.OkAsync(new GetRoleCapabilitiesResponse { Items = items }, cancellation: ct);
    }
}
