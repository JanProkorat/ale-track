namespace AleTrack.Features.Reports.Utils;

/// <summary>Bucket width for a report's time series.</summary>
public enum ReportGranularity
{
    Day,
    Week,
    Month
}

/// <summary>Common inclusive date window shared by every report request.</summary>
public abstract record ReportWindowRequest
{
    /// <summary>First day included in the report (inclusive).</summary>
    public DateOnly From { get; set; }

    /// <summary>Last day included in the report (inclusive).</summary>
    public DateOnly To { get; set; }
}

/// <summary>One day's totals, before roll-up.</summary>
public readonly record struct DailyBucket(DateOnly Date, decimal WeightKg, int Units);

/// <summary>One point of a report time series. Shared by every report that has a trend.</summary>
public sealed record ReportSeriesPointDto
{
    /// <summary>First day of the bucket — the day itself, its ISO Monday, or the 1st of the month.</summary>
    public DateOnly BucketStart { get; set; }

    /// <summary>Total delivered weight in the bucket, kilograms.</summary>
    public decimal WeightKg { get; set; }

    /// <summary>Total delivered units in the bucket.</summary>
    public int Units { get; set; }
}

/// <summary>
/// Rolls daily totals up into day / week / month buckets in memory. Deliberately not done in
/// SQL: week truncation is provider-specific and the windows involved are small.
/// </summary>
public static class ReportBucketing
{
    public static List<ReportSeriesPointDto> RollUp(IEnumerable<DailyBucket> daily, ReportGranularity granularity)
    {
        return daily
            .GroupBy(d => BucketStart(d.Date, granularity))
            .OrderBy(g => g.Key)
            .Select(g => new ReportSeriesPointDto
            {
                BucketStart = g.Key,
                WeightKg = g.Sum(x => x.WeightKg),
                Units = g.Sum(x => x.Units)
            })
            .ToList();
    }

    /// <summary>Monday of the ISO week for <see cref="ReportGranularity.Week"/>; the 1st for Month.</summary>
    public static DateOnly BucketStart(DateOnly date, ReportGranularity granularity)
    {
        return granularity switch
        {
            ReportGranularity.Day => date,
            ReportGranularity.Week => date.AddDays(-(((int)date.DayOfWeek + 6) % 7)),
            ReportGranularity.Month => new DateOnly(date.Year, date.Month, 1),
            _ => throw new ArgumentOutOfRangeException(nameof(granularity))
        };
    }
}
