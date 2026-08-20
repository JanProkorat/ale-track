using System.Security.Cryptography;
using System.Text;

namespace AleTrack.Features.Products.Import;

/// <summary>
/// Identity of an uploaded price list, so an apply cannot be handed a different file than the one
/// the user reviewed.
/// </summary>
/// <remarks>
/// Computed over normalised content — line endings unified and trailing whitespace dropped — so a
/// file that survives a round trip through a browser or an editor still matches the preview it was
/// approved from. Anything that changes a value changes the hash.
/// </remarks>
public static class PriceListSourceHash
{
    /// <summary>
    /// Lowercase hex SHA-256 of <paramref name="content"/>.
    /// </summary>
    public static string Compute(string content)
    {
        var normalised = string.Join('\n',
            content.Replace("\r\n", "\n").Split('\n').Select(line => line.TrimEnd()));

        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(normalised)));
    }
}
