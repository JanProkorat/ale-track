using AleTrack.Common.Enums;

namespace AleTrack.Features.Products.Utils;

/// <summary>
/// Bridges the explicit packaging pair — <see cref="ProductContainer"/> plus
/// <see cref="ProductSaleUnit"/> — onto the coarser <see cref="ProductKind"/> that grouping,
/// ordering and the reporting projections are keyed on.
/// </summary>
public static class ProductPackaging
{
    /// <summary>
    /// The container and sale unit implied by a product recorded in the superseded shape, where
    /// packaging lived in <see cref="ProductKind"/> plus the container volume.
    /// </summary>
    /// <remarks>
    /// The C# mirror of the backfill in the <c>AddProductPackaging</c> migration — same branches in
    /// the same order, so seeded data and migrated data cannot disagree. Used for rows nobody has
    /// restated yet; anything created since carries its packaging explicitly.
    /// </remarks>
    public static (ProductContainer Container, ProductSaleUnit SaleUnit) FromLegacyShape(
        ProductKind kind, double? packageSize, int unitsPerPackage, string? name) =>
        (LegacyContainer(kind, packageSize, name), LegacySaleUnit(kind, packageSize, unitsPerPackage));

    /// <summary>
    /// The <see cref="ProductKind"/> a container and sale unit add up to.
    /// </summary>
    /// <remarks>
    /// Order matters. A keg is a keg however it is sold. A pack is a pack whatever is in it. "Sold
    /// as a crate" is what drives the Basa grouping, so it outranks the container. Only then does
    /// the container decide. Everything left over — a jug above all — is <see cref="ProductKind.Other"/>,
    /// which is the point: it is no longer silently filed under Basa.
    /// </remarks>
    public static ProductKind DeriveKind(ProductContainer container, ProductSaleUnit saleUnit)
    {
        if (container == ProductContainer.Keg)
        {
            return ProductKind.Keg;
        }

        if (saleUnit == ProductSaleUnit.Multipack)
        {
            return ProductKind.Multipack;
        }

        if (saleUnit == ProductSaleUnit.Crate)
        {
            return ProductKind.Bottle;
        }

        return container == ProductContainer.Can ? ProductKind.Can : ProductKind.Other;
    }

    private static readonly double[] CratedBottleVolumes = [0.33, 0.5];

    private static ProductContainer LegacyContainer(
        ProductKind kind, double? packageSize, string? name)
    {
        if (kind == ProductKind.Keg)
        {
            return ProductContainer.Keg;
        }

        if (kind == ProductKind.Bottle)
        {
            // 0.75 l is glass sold singly; 10 l is the superseded crate encoding. Both stay bottles.
            // Only the 1 l and 2 l decorative sizes become jugs.
            return packageSize is 1.0 or 2.0 ? ProductContainer.Jug : ProductContainer.Bottle;
        }

        if (kind == ProductKind.Can)
        {
            return ProductContainer.Can;
        }

        if (kind == ProductKind.Multipack)
        {
            return name?.Contains("plech", StringComparison.OrdinalIgnoreCase) == true
                ? ProductContainer.Can
                : ProductContainer.Bottle;
        }

        return ProductContainer.Other;
    }

    private static ProductSaleUnit LegacySaleUnit(
        ProductKind kind, double? packageSize, int unitsPerPackage)
    {
        if (kind == ProductKind.Bottle && packageSize is { } volume
            && CratedBottleVolumes.Contains(volume))
        {
            return ProductSaleUnit.Crate;
        }

        if (kind == ProductKind.Can && unitsPerPackage > 1)
        {
            return ProductSaleUnit.Tray;
        }

        return kind == ProductKind.Multipack ? ProductSaleUnit.Multipack : ProductSaleUnit.Single;
    }
}
