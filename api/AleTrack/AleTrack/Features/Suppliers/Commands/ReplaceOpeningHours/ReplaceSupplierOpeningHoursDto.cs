namespace AleTrack.Features.Suppliers.Commands.ReplaceOpeningHours;

/// <summary>
/// The supplier's whole weekly schedule. Replaces what is stored: the editor is one form
/// over the entire week, so sending it whole keeps the client from diffing intervals into
/// per-row calls and puts the no-overlap rule in one place.
/// </summary>
public sealed record ReplaceSupplierOpeningHoursDto
{
    /// <summary>
    /// Every interval of the week. An empty list means the supplier has no opening hours
    /// recorded, which reads as permanently closed.
    /// </summary>
    public List<SupplierOpeningHoursUpsertDto> OpeningHours { get; set; } = [];
}

/// <summary>
/// One opening interval as it arrives from the editor.
/// </summary>
public sealed record SupplierOpeningHoursUpsertDto
{
    /// <summary>
    /// Weekday the interval falls on. <see cref="System.DayOfWeek"/>, so Sunday is 0.
    /// </summary>
    public DayOfWeek DayOfWeek { get; set; }

    /// <summary>
    /// When the interval opens
    /// </summary>
    public TimeOnly From { get; set; }

    /// <summary>
    /// When the interval closes. Must be later than <see cref="From"/>. A nonstop point is
    /// 00:00–23:59, since neither <see cref="TimeOnly"/> nor an HTML time input can express
    /// 24:00.
    /// </summary>
    public TimeOnly To { get; set; }
}
