using System.Globalization;
using FastEndpoints;
using Microsoft.Extensions.Primitives;

namespace AleTrack.Common.Utils;

/// <summary>
/// Binds a <see cref="DateOnly"/> from either wire form a browser sends.
/// </summary>
/// <remarks>
/// The generated TypeScript client formats a date-only value as <c>yyyy-MM-dd</c> inside a JSON
/// body, but calls <c>Date.toJSON()</c> for a form field or a query string, which produces a full
/// ISO-8601 instant. FastEndpoints' stock parser rejects the second form outright, so the first
/// endpoint in this codebase to take a date as a form field failed to bind at all.
///
/// The instant's UTC date is what is taken, which is only correct because the client is expected to
/// send UTC midnight for the calendar date the user picked. Converting a local midnight instead
/// would land on the previous day for any timezone east of UTC — the reason this cannot simply
/// truncate whatever instant arrives and be considered safe.
/// </remarks>
public static class DateOnlyValueParser
{
    /// <summary>
    /// Parses <paramref name="input"/>, accepting <c>2026-05-01</c> or <c>2026-05-01T00:00:00.000Z</c>.
    /// </summary>
    public static ParseResult Parse(StringValues input)
    {
        var raw = input.ToString();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return new ParseResult(false, null);
        }

        if (DateOnly.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            return new ParseResult(true, date);
        }

        if (DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture,
                DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var instant))
        {
            return new ParseResult(true, DateOnly.FromDateTime(instant.UtcDateTime));
        }

        return new ParseResult(false, null);
    }
}
