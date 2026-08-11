using System.Collections.Concurrent;
using AleTrack.Entities;
using AleTrack.Features.Products.Import;
using AleTrack.Features.Products.Utils;

namespace AleTrack.Seeding.Builders;

/// <summary>
/// Reads a committed brewery price list into seedable products.
/// </summary>
/// <remarks>
/// The prices a brewery publishes belong in the brewery's own file, not retyped into C# literals
/// that then drift — the seeded Svijanská Desítka crate stood at 296,00 Kč while the brewery's
/// list said 318,00 Kč, and nothing recorded which list either number came from. The catalogue
/// files carry that provenance in their metadata lines, and go through the same parser an uploaded
/// price list does, so the seeded catalogue and an imported one cannot be read differently.
/// </remarks>
internal static class SeedingCatalog
{
    private static readonly ConcurrentDictionary<string, List<PriceListRow>> ParsedFiles = new();

    /// <summary>
    /// The products of one section of a catalogue file, as fresh entities on every call — the
    /// builders are called more than once per process and EF must not be handed shared instances.
    /// </summary>
    /// <param name="fileName">File under <c>Catalog/</c>, e.g. <c>svijany-2026-05-01.csv</c>.</param>
    /// <param name="section">Which rows this builder method owns.</param>
    public static List<Product> Products(string fileName, Func<PriceListRow, bool> section) =>
        Rows(fileName).Where(section).Select(ToProduct).ToList();

    /// <summary>
    /// Every row of a catalogue file, parsed once per process.
    /// </summary>
    public static IReadOnlyList<PriceListRow> Rows(string fileName) =>
        ParsedFiles.GetOrAdd(fileName, Parse);

    private static List<PriceListRow> Parse(string fileName)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Catalog", fileName);
        var result = PriceListCatalogParser.Parse(File.ReadAllText(path));

        // A seed that silently skipped a malformed row would put wrong prices in a database and
        // report success; there is no partial success worth having here.
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Price list '{fileName}' could not be read: "
                + string.Join("; ", result.Errors.Select(e => $"line {e.Line}: {e.Message}")));
        }

        return result.Catalog!.Rows;
    }

    private static Product ToProduct(PriceListRow row) => new()
    {
        // A blank public_id means the list has no identity to preserve; Rohozec's pins its own.
        PublicId = row.PublicId ?? Guid.NewGuid(),
        Name = row.Name,
        Type = row.Type,
        Container = row.Container,
        SaleUnit = row.SaleUnit,
        Kind = ProductPackaging.DeriveKind(row.Container, row.SaleUnit),
        AlcoholPercentage = row.AlcoholPercentage,
        PlatoDegree = row.PlatoDegree,
        PackageSize = row.VolumeLiters,
        UnitsPerPackage = row.UnitsPerPackage,
        PriceForUnitWithoutVat = row.UnitPriceWithoutVat,
        PriceForUnitWithVat = row.UnitPriceWithVat,
        PriceWithoutVat = row.PackPriceWithoutVat,
        PriceWithVat = row.PackPriceWithVat
    };
}
