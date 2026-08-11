using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Seeding.Builders;

/// <summary>
/// Rohozec's product range, read from the brewery's own price list rather than retyped.
/// </summary>
/// <remarks>
/// The catalogue file pins each product's <c>PublicId</c> to the value this builder used to hand
/// out, so re-seeding does not silently give every Rohozec product a new identity. Its list is the
/// one valid from 1 May 2024 — the newest the brewery has published — which is fine for a demo
/// database and is not to be applied to a production catalogue.
/// </remarks>
public static class RohozecProductsBuilder
{
    private const string CatalogFile = "rohozec-2024-05-01.csv";

    /// <summary>
    /// Beer and lemonade kegs — Sudové pivo and Sudové limo.
    /// </summary>
    public static List<Product> GetRohozecKegProducts() =>
        SeedingCatalog.Products(CatalogFile, r => r.Container == ProductContainer.Keg);

    /// <summary>
    /// Bottled beer and lemonade, sold by the 20-bottle přepravka.
    /// </summary>
    public static List<Product> GetRohozecBottleProducts() =>
        SeedingCatalog.Products(CatalogFile, r => r.Container == ProductContainer.Bottle);

    /// <summary>
    /// Cans, sold by the 12-can tray.
    /// </summary>
    public static List<Product> GetRohozecCanProducts() =>
        SeedingCatalog.Products(CatalogFile, r => r.Container == ProductContainer.Can);
}
