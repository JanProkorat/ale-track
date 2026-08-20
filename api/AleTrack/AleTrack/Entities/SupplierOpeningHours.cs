using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// One opening interval of a <see cref="Supplier"/>, recurring weekly.
/// </summary>
/// <remarks>
/// Several rows may share a <see cref="DayOfWeek"/> — that is how a lunch break is
/// recorded, as two intervals rather than one interval and a prose note, so the app can
/// answer "is it open right now" instead of leaving it to whoever reads the note. A weekday
/// with no row at all is closed.
///
/// A nonstop point is stored as 00:00–23:59, not 00:00–24:00: <see cref="TimeOnly"/> cannot
/// represent 24:00 and neither can the HTML time input the editor uses. "Nonstop" is
/// therefore how that pair is rendered, not a flag on the row.
/// </remarks>
[Table("supplier_opening_hours")]
public sealed class SupplierOpeningHours : BaseEntity
{
    /// <summary>
    /// ID of related <see cref="Supplier"/>
    /// </summary>
    [Column("supplier_id")]
    public long SupplierId { get; set; }

    /// <summary>
    /// Weekday the interval falls on.
    /// </summary>
    /// <remarks>
    /// <see cref="System.DayOfWeek"/> counts from Sunday; the UI orders Monday-first, which
    /// is a presentation concern and stays in the frontend. <see cref="Reminder"/> already
    /// persists this enum, so it is the established choice here.
    /// </remarks>
    [Column("day_of_week")]
    public DayOfWeek DayOfWeek { get; set; }

    /// <summary>
    /// When the interval opens
    /// </summary>
    [Column("from_time")]
    public TimeOnly From { get; set; }

    /// <summary>
    /// When the interval closes. Always later than <see cref="From"/>.
    /// </summary>
    [Column("to_time")]
    public TimeOnly To { get; set; }

    /// <summary>
    /// Related supplier
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Supplier Supplier { get; set; } = null!;
}
