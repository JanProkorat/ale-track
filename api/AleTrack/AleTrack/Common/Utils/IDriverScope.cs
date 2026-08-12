namespace AleTrack.Common.Utils;

/// <summary>
/// Row-level scoping for driver accounts. A driver sees only their own driver record and
/// only the outgoing shipments they are assigned to. Distinct from the capability layer,
/// which hides content rather than filtering rows.
/// </summary>
public interface IDriverScope
{
    /// <summary>
    /// True when the caller's roles contain Driver and not Admin. Reads claims only,
    /// so the non-driver case costs no query.
    /// </summary>
    bool IsScoped { get; }

    /// <summary>
    /// Internal id of the driver record linked to the caller's account, or null when the
    /// account has no link. Null means the caller matches nothing — every scoped query and
    /// guard fails closed rather than falling back to unfiltered access.
    /// </summary>
    /// <param name="ct">Cancellation token.</param>
    Task<long?> GetDriverIdAsync(CancellationToken ct);
}
