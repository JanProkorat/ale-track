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

        var map = hiddenRows
            .GroupBy(x => x.Role)
            .ToDictionary(g => g.Key, g => g.Select(x => x.CapabilityKey).ToHashSet(StringComparer.Ordinal));

        cache.Set(CacheKey, map);

        return map;
    }
}
