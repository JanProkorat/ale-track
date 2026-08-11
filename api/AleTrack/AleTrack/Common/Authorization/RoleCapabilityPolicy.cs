using AleTrack.Common.Enums;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace AleTrack.Common.Authorization;

/// <summary>
/// The authoritative read of role → hidden capability keys, cached because it is consulted on
/// every gated request and the table is a handful of rows. Default-allow: only rows explicitly
/// marked not visible are returned.
/// </summary>
public sealed class RoleCapabilityPolicy(AleTrackDbContext dbContext, IMemoryCache cache)
{
    /// <summary>
    /// Cache key holding the whole table as a role → hidden-keys map.
    /// </summary>
    public const string CacheKey = "role-capabilities";

    /// <summary>
    /// Absolute expiration backstop on top of <see cref="Invalidate"/>, which the role capability
    /// PUT endpoint calls after every save. This backstop covers what that call cannot reach: a
    /// direct database edit (bypassing the endpoint, so nothing calls <see cref="Invalidate"/>)
    /// and multi-instance deployments (a save on one instance cannot clear another instance's
    /// in-process cache). The table is a handful of rows, so a re-read every couple of minutes
    /// is free.
    /// </summary>
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(2);

    /// <summary>
    /// Capability keys <paramref name="role"/> may not see.
    /// </summary>
    public async Task<IReadOnlySet<string>> GetHiddenKeysAsync(UserRoleType role, CancellationToken ct)
    {
        var map = await GetMapAsync(ct);

        return map.TryGetValue(role, out var hidden) ? hidden : new HashSet<string>();
    }

    /// <summary>
    /// Drops the cached map so the next read reflects a saved change.
    /// </summary>
    public void Invalidate() => cache.Remove(CacheKey);

    private async Task<Dictionary<UserRoleType, HashSet<string>>> GetMapAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(CacheKey, out Dictionary<UserRoleType, HashSet<string>>? cached) && cached is not null)
        {
            return cached;
        }

        var hiddenRows = await dbContext.RoleCapabilities
            .AsNoTracking()
            .Where(x => !x.IsVisible)
            .Select(x => new { x.Role, x.CapabilityKey })
            .ToListAsync(ct);

        // OrdinalIgnoreCase is deliberate: enum member names cannot collide case-insensitively,
        // so this can only ever close the gate, never over-hide. A row saved with different
        // casing than the enum name (e.g. by a future writer) must still match.
        var map = hiddenRows
            .GroupBy(x => x.Role)
            .ToDictionary(g => g.Key, g => g.Select(x => x.CapabilityKey).ToHashSet(StringComparer.OrdinalIgnoreCase));

        cache.Set(CacheKey, map, CacheDuration);

        return map;
    }
}
