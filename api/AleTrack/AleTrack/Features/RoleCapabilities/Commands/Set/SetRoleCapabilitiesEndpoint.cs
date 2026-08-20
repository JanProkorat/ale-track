using AleTrack.Common.Authorization;
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.RoleCapabilities.Commands.Set;

/// <summary>
/// Endpoint replacing the stored visibility for exactly the (role, capability key) pairs named
/// in the payload, for the admin editor screen. A stored row for a pair the payload does not
/// mention is left untouched — never the whole table — so a capability the frontend registry
/// has since forgotten about (a rename, a removed entry) keeps whatever visibility it last had
/// instead of reverting to default-allow on the next save.
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
            s.Summary = "Set which components each role may see";
            s.Responses[StatusCodes.Status204NoContent] = "Saved";
            s.Responses[StatusCodes.Status400BadRequest] = "Items is null, a row targets Admin, a key is invalid, or the same role/key pair is duplicated";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetRoleCapabilitiesDto req, CancellationToken ct)
    {
        // Upsert only the (role, key) pairs the payload actually names — never the whole table.
        // A frontend registry that no longer knows about a stored key (e.g. after a rename) must
        // not be able to drop that key's row just because an admin clicked Uložit: the row may
        // still be the only thing keeping a capability an endpoint gates on via RequireCapability
        // closed. Matched case-insensitively (OrdinalIgnoreCase), consistent with
        // RoleCapabilityPolicy's read side and the validator's duplicate check.
        //
        // Updating in place rather than delete-then-insert is deliberate. It keeps this to a
        // single SaveChangesAsync, which EF already makes atomic, so no explicit transaction is
        // needed — and this DbContext registers a retrying execution strategy
        // (BrokenConnectionRetryStrategy), which refuses user-initiated transactions outright.
        // It also avoids churning the identity sequence and can never trip the unique index on
        // (role, capability_key) by inserting a replacement before its predecessor is gone.
        var existingRows = await dbContext.RoleCapabilities.ToListAsync(ct);

        foreach (var item in req.Items)
        {
            var existing = existingRows.FirstOrDefault(row =>
                row.Role == item.Role
                && string.Equals(row.CapabilityKey, item.CapabilityKey, StringComparison.OrdinalIgnoreCase));

            if (existing is null)
            {
                dbContext.RoleCapabilities.Add(new RoleCapability
                {
                    Role = item.Role,
                    CapabilityKey = item.CapabilityKey,
                    IsVisible = item.IsVisible
                });

                continue;
            }

            existing.IsVisible = item.IsVisible;
        }

        await dbContext.SaveChangesAsync(ct);

        // Next request must see the saved policy, not the map cached before this write.
        policy.Invalidate();

        await Send.NoContentAsync(ct);
    }
}
