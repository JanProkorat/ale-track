using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Import;
using AleTrack.Features.Products.Utils;

namespace AleTrack.Seeding.Builders;

/// <summary>
/// Svijany's product range, read from the brewery's own price list rather than retyped.
/// </summary>
/// <remarks>
/// Every priced product comes from <see cref="CatalogFile"/>; the methods below are views over it,
/// one per section of the printed list, and together they cover every row — <c>SeededPriceListCatalogTests</c>
/// is what keeps that true when a section is added. Only merchandise, which the price list gives no
/// drink attributes, stays a literal.
/// </remarks>
internal static class SvijanyProductsBuilder
{
    /// <summary>The brewery's list valid from 1 May 2026.</summary>
    private const string CatalogFile = "svijany-2026-05-01.csv";

    /// <summary>
    /// Bottled beer sold by the crate — LAHVE.
    /// </summary>
    public static List<Product> GetSampleBottledProducts() =>
        SeedingCatalog.Products(CatalogFile, IsCratedBottle);

    /// <summary>
    /// Beer kegs — SUDY. Excludes the lemonade kegs and the 5 l soudky, which have their own
    /// sections and their own builders.
    /// </summary>
    public static List<Product> GetSampleKegProducts() =>
        SeedingCatalog.Products(CatalogFile, r => IsKegOfItsOwnSection(r) && r.Type != ProductType.Lemonade);

    /// <summary>
    /// Lemonade kegs — SUDY - LIMONÁDY.
    /// </summary>
    public static List<Product> GetSampleLimoKegProducts() =>
        SeedingCatalog.Products(CatalogFile, r => IsKegOfItsOwnSection(r) && r.Type == ProductType.Lemonade);

    /// <summary>
    /// Carried packs of bottles — MULTIPACKY. A duopack is also a bottle multipack, so it is the
    /// pack size that separates the two sections.
    /// </summary>
    public static List<Product> GetSampleMultipackProducts() =>
        SeedingCatalog.Products(CatalogFile, r => IsBottleMultipack(r) && r.UnitsPerPackage > 2);

    /// <summary>
    /// Half-litre cans — PLECHOVKY 0,5 L and SVIJANELA PLECHOVKY 0,5 L.
    /// </summary>
    public static List<Product> GetSampleCanZeroPointFiveProducts() =>
        SeedingCatalog.Products(CatalogFile, r => IsCan(r, CanSize.ZeroPointFiveLiters));

    /// <summary>
    /// Third-litre cans — PLECHOVKY 0,33 L.
    /// </summary>
    public static List<Product> GetSampleCanZeroPointThreeProducts() =>
        SeedingCatalog.Products(CatalogFile, r => IsCan(r, CanSize.ZeroPointThreeThreeLiters));

    /// <summary>
    /// Two-litre cans sold per piece — PLECHOVKY 2L. A genuine can, not a jug.
    /// </summary>
    public static List<Product> GetSampleTwoLiterCanProducts() =>
        SeedingCatalog.Products(CatalogFile, r => IsCan(r, CanSize.TwoLiters));

    /// <summary>
    /// Five-litre party kegs — SOUDKY 5 L.
    /// </summary>
    public static List<Product> GetSampleFiveLiterKegProducts() =>
        SeedingCatalog.Products(CatalogFile, IsFiveLitreSoudek);

    /// <summary>
    /// Decorative bottles and jugs — DEKORATIVNÍ LAHVE, DŽBÁNY.
    /// </summary>
    public static List<Product> GetSampleDecorativeBottleProducts() =>
        SeedingCatalog.Products(CatalogFile, r => r.Container == ProductContainer.Jug);

    /// <summary>
    /// Two-bottle packs — DUOPACKY.
    /// </summary>
    public static List<Product> GetSampleDuoPackProducts() =>
        SeedingCatalog.Products(CatalogFile, r => IsBottleMultipack(r) && r.UnitsPerPackage == 2);

    /// <summary>
    /// Merchandise. On the price list, but with no volume, strength or packaging to import.
    /// </summary>
    public static List<Product> GetSampleOtherProducts() =>
    [
        new Product
        {
            PublicId = Guid.NewGuid(),
            Name = "Ucho soudku",
            Kind = ProductKind.Other,
            Type = ProductType.Other,
            PriceWithVat = 30.00m
        }
    ];

    private static bool IsCratedBottle(PriceListRow row) =>
        row is { Container: ProductContainer.Bottle, SaleUnit: ProductSaleUnit.Crate };

    private static bool IsBottleMultipack(PriceListRow row) =>
        row is { Container: ProductContainer.Bottle, SaleUnit: ProductSaleUnit.Multipack };

    private static bool IsCan(PriceListRow row, double volumeLiters) =>
        row.Container == ProductContainer.Can && row.VolumeLiters == volumeLiters;

    private static bool IsFiveLitreSoudek(PriceListRow row) =>
        row.Container == ProductContainer.Keg && row.VolumeLiters == KegSize.FiveLiters;

    private static bool IsKegOfItsOwnSection(PriceListRow row) =>
        row.Container == ProductContainer.Keg && !IsFiveLitreSoudek(row);
}
