using AleTrack.Entities;

namespace AleTrack.Features.ProductDeliveries.Utils;

/// <summary>
/// Records the weight inputs of the product a delivery line books in.
/// </summary>
/// <remarks>
/// Written whenever the line is written. One helper rather than three inline copies, because the
/// create endpoint builds delivery items in two places and the update endpoint in a third —
/// duplicating the copy is how one of them ends up forgotten.
/// </remarks>
public static class DeliveryItemSnapshot
{
    /// <summary>
    /// Copies <paramref name="product"/>'s kind, container volume and units per package onto
    /// <paramref name="item"/>.
    /// </summary>
    public static void Apply(DeliveryItem item, Product product)
    {
        item.Kind = product.Kind;
        item.PackageSize = product.PackageSize;
        item.UnitsPerPackage = product.UnitsPerPackage;
    }
}
