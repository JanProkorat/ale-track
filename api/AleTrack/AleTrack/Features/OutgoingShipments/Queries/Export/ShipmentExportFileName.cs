using System.Globalization;
using System.Text;

namespace AleTrack.Features.OutgoingShipments.Queries.Export;

/// <summary>
/// Download name of a shipment export workbook.
/// </summary>
/// <remarks>
/// Its own type rather than a private helper on the endpoint so the naming rule — which decides what
/// a folder of exports sorts like — is testable without going through HTTP.
/// </remarks>
public static class ShipmentExportFileName
{
    /// <summary>
    /// Builds the download name — <c>vyvoz-2026-08-03-patek-brno.xlsx</c>.
    /// </summary>
    /// <remarks>
    /// The delivery date leads so a folder of exports sorts chronologically, and is dropped
    /// entirely from a run that has no date yet rather than leaving a gap or a placeholder. The
    /// run's name follows because a date alone collides as soon as two runs go out on the same day.
    /// </remarks>
    /// <param name="model">The run being exported.</param>
    /// <param name="extension">File extension without the dot — <c>xlsx</c> or <c>docx</c>.</param>
    public static string For(ShipmentExportModel model, string extension)
    {
        var parts = new[]
            {
                "vyvoz",
                model.DeliveryDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                Slug(model.ShipmentName)
            }
            .Where(part => !string.IsNullOrEmpty(part));

        return $"{string.Join('-', parts)}.{extension}";
    }

    /// <summary>
    /// Reduces a name to lowercase ASCII words joined by hyphens, so it survives every filesystem
    /// and every browser's Content-Disposition handling.
    /// </summary>
    private static string Slug(string value)
    {
        var builder = new StringBuilder();

        // Decomposing first turns "Pátek" into "Pa" + a combining acute, so dropping the marks
        // leaves readable ASCII rather than deleting the letter along with its diacritic.
        foreach (var character in value.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark)
                continue;

            if (char.IsAsciiLetterOrDigit(character))
                builder.Append(char.ToLowerInvariant(character));
            else if (builder.Length > 0 && builder[^1] != '-')
                builder.Append('-');
        }

        return builder.ToString().Trim('-');
    }
}
