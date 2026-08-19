namespace AleTrack.Common.Enums;

/// <summary>
/// Where a <see cref="Entities.SupplierGood"/> is collected from when an order carrying it
/// is planned onto an outgoing shipment.
/// </summary>
/// <remarks>
/// A property of the good rather than of the order line: whether we keep CO₂ bottles in the
/// garage or fetch them from the plnírna is a standing arrangement with that supplier, not
/// something decided per order. It is what decides which stop the run gains — see
/// <c>SupplierPickupStopReconciler</c>.
/// </remarks>
public enum SupplierGoodPickupSource
{
    /// <summary>
    /// Already on our own shelves — the run collects it at the company warehouse, so it
    /// joins the existing company stop rather than adding a trip.
    /// </summary>
    Garage = 0,

    /// <summary>
    /// Collected at the supplier — the run has to call there, which is a stop of its own.
    /// </summary>
    Supplier = 1
}
