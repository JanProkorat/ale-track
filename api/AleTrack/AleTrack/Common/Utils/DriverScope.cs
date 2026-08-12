using AleTrack.Common.Enums;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Common.Utils;

/// <inheritdoc />
public sealed class DriverScope(IAppContext appContext, AleTrackDbContext dbContext) : IDriverScope
{
    private bool _resolved;
    private long? _driverId;

    /// <inheritdoc />
    public bool IsScoped =>
        appContext.Roles.Contains(UserRoleType.Driver) && !appContext.Roles.Contains(UserRoleType.Admin);

    /// <inheritdoc />
    public async Task<long?> GetDriverIdAsync(CancellationToken ct)
    {
        // Memoized per request: several endpoints ask more than once, and the answer
        // cannot change mid-request. Resolved from the database rather than a token claim
        // so re-pointing a link takes effect on the next request, not the next sign-in.
        if (_resolved)
        {
            return _driverId;
        }

        var userId = appContext.UserId;
        if (userId is not null)
        {
            _driverId = await dbContext.Drivers
                .AsNoTracking()
                .Where(d => d.User != null && d.User.PublicId == userId)
                .Select(d => (long?)d.Id)
                .FirstOrDefaultAsync(ct);
        }

        _resolved = true;
        return _driverId;
    }
}
