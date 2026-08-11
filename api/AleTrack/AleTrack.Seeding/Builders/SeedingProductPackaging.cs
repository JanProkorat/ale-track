using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;

namespace AleTrack.Seeding.Builders;

/// <summary>
/// Fills in the packaging pair on seeded products.
/// </summary>
/// <remarks>
/// The Primátor builder still describes its fixtures in the superseded shape — a
/// <see cref="AleTrack.Common.Enums.ProductKind"/> plus a container volume — because the brewery
/// publishes no price list to read one from, so packaging is resolved for those rows here through
/// the same mapping the database migration applies. Svijany and Rohozec come from their brewery's
/// catalogue file and already state their packaging; those rows are left alone.
/// </remarks>
internal static class SeedingProductPackaging
{
    /// <summary>
    /// Sets <c>Container</c>, <c>SaleUnit</c> and the derived <c>Kind</c> on every product still
    /// described in the superseded shape.
    /// </summary>
    public static void Fill(IEnumerable<Product> products)
    {
        foreach (var product in products)
        {
            // A product read from a price list states its packaging outright, and the legacy
            // mapping cannot reproduce it: it has no way to tell a jug from a bottle, or a mixed
            // clip of cans from a pack of bottles, because the old shape could not say either.
            if (product.Container != ProductContainer.Other || product.SaleUnit != ProductSaleUnit.Single)
            {
                continue;
            }

            var (container, saleUnit) = ProductPackaging.FromLegacyShape(
                product.Kind, product.PackageSize, product.UnitsPerPackage, product.Name);

            product.Container = container;
            product.SaleUnit = saleUnit;
            product.Kind = ProductPackaging.DeriveKind(container, saleUnit);
        }
    }
}
