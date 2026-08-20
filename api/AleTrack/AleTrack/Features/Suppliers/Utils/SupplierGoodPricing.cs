using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Features.Suppliers.Utils;

/// <summary>
/// Which row of a <see cref="SupplierGood"/>'s price list an order line is charged at.
/// </summary>
/// <remarks>
/// A good is priced several ways at once — see <see cref="SupplierChargeKind"/> — and an order
/// line does not record which was agreed, so one of them has to be the line's price. Plnění is
/// it: gas refilled into a bottle we already hold is what a run actually collects, and a good
/// that prices no refill falls back to whatever it prices first.
///
/// Stated in three places, which have to agree or the same line reads at one price in the order
/// and another on the invoice: <c>GetOrderDetailEndpoint</c>'s projection (the same rule written
/// as a LINQ-to-SQL <c>OrderBy</c>, because it runs in the database), the frontend's
/// <c>primaryPrice</c> in <c>supplierGoodCatalogModel.ts</c> (which prices a line the picker has
/// not saved yet), and this — the one the invoice freezes onto its line.
/// </remarks>
public static class SupplierGoodPricing
{
    /// <summary>
    /// The price row an order line for this good is charged at, or null when it has none.
    /// </summary>
    public static SupplierGoodPrice? Primary(IEnumerable<SupplierGoodPrice>? prices) =>
        prices?
            .OrderBy(p => p.Kind == SupplierChargeKind.Fill ? 0 : 1)
            .FirstOrDefault();
}
