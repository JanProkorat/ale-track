using AleTrack.Common.Authorization;
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.RoleCapabilities.Commands.Set;

/// <summary>
/// Endpoint replacing the whole role capability table, for the admin editor screen.
/// </summary>
/// <param name="dbContext"></param>
/// <param name="policy"></param>
public sealed class SetRoleCapabilitiesEndpoint(AleTrackDbContext dbContext, RoleCapabilityPolicy policy)
    : Endpoint<SetRoleCapabilitiesDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("role-capabilities");
        Description(b => b
            .RequirePermission(ModuleType.Users, PermissionLevel.Edit)
            .Produces(StatusCodes.Status204NoContent)
            .WithName(nameof(SetRoleCapabilitiesEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Replace which components each role may see";
            s.Responses[StatusCodes.Status204NoContent] = "Saved";
            s.Responses[StatusCodes.Status400BadRequest] = "A row targets Admin, a key is invalid, or the same role/key pair is duplicated";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetRoleCapabilitiesDto req, CancellationToken ct)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);

        dbContext.RoleCapabilities.RemoveRange(await dbContext.RoleCapabilities.ToListAsync(ct));
        dbContext.RoleCapabilities.AddRange(req.Items.Select(item => new RoleCapability
        {
            Role = item.Role,
            CapabilityKey = item.CapabilityKey,
            IsVisible = item.IsVisible
        }));

        await dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        // Next request must see the saved policy, not the map cached before this write.
        policy.Invalidate();

        await Send.NoContentAsync(ct);
    }
}
