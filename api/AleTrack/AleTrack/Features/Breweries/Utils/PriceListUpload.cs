using System.Text;
using AleTrack.Common.Utils;
using AleTrack.Features.Products.Import;

namespace AleTrack.Features.Breweries.Utils;

/// <summary>
/// An uploaded price list, read once: its text, its identity, and the rows it holds.
/// </summary>
/// <param name="Content">The file's text.</param>
/// <param name="SourceHash">Identity of that text, as the preview hands out and the apply checks.</param>
/// <param name="Catalog">The parsed list.</param>
public sealed record PriceListUpload(string Content, string SourceHash, PriceListCatalog Catalog)
{
    /// <summary>
    /// Reads and parses an uploaded file, or refuses it with every reason at once.
    /// </summary>
    /// <remarks>
    /// UTF-8 without a declared encoding: the catalogue format is ASCII apart from product names,
    /// and every source that produces one — the committed files, a spreadsheet export — writes
    /// UTF-8. A byte-order mark is tolerated so a file saved by Excel still reads.
    /// </remarks>
    public static async Task<PriceListUpload> ReadAsync(IFormFile file, CancellationToken ct)
    {
        using var reader = new StreamReader(file.OpenReadStream(), Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        var content = await reader.ReadToEndAsync(ct);

        var result = PriceListCatalogParser.Parse(content);
        if (!result.Succeeded)
        {
            ThrowHelper.PriceListUnreadable([.. result.Errors]);
        }

        return new PriceListUpload(content, PriceListSourceHash.Compute(content), result.Catalog!);
    }
}
