using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// The one rule turning a good's standing pickup default into a line's opening split.
/// </summary>
/// <remarks>
/// Three callers need it and must agree: creating a line, changing a line's quantity, and
/// freeing an order from a cancelled run. A second copy of "Garage means all of them" is
/// exactly how a run ends up keeping a supplier stop for goods nobody is collecting there.
/// </remarks>
public static class SupplierGoodSourcing
{
    /// <summary>
    /// Pieces taken from the garage when nobody has decided otherwise: all of them for a good
    /// we keep in stock, none for one we fetch.
    /// </summary>
    public static int DefaultFromGarage(SupplierGood good, int quantity) =>
        good.PickupSource == SupplierGoodPickupSource.Garage ? quantity : 0;

    /// <summary>
    /// Keeps an existing split valid after its line's quantity changed.
    /// </summary>
    /// <remarks>
    /// Clamped rather than re-seeded: the split is a decision somebody made on the shipment,
    /// and cutting an order from 5 pieces to 3 is no reason to discard it. Only the part that
    /// no longer exists is dropped.
    /// </remarks>
    public static int Clamp(int quantityFromGarage, int quantity) =>
        Math.Clamp(quantityFromGarage, 0, Math.Max(quantity, 0));
}
