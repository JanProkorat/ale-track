using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Keeps exactly one <see cref="OutgoingShipmentStopKind.Company"/> stop on a run
/// for as long as it has business at our own warehouse.
/// </summary>
/// <remarks>
/// Enforced server-side rather than in the two client write paths (the nakládka
/// toggles on the detail screen and the route save in the editor), because it is an
/// invariant of the shipment and one place cannot fall out of step with the other.
///
/// An existing stop keeps its position. A run may legitimately call at the warehouse
/// in the middle of the route — unload our goods, carry on abroad, come home — and
/// an unrelated save must not shove it back to the end.
/// </remarks>
public static class CompanyStopReconciler
{
    /// <summary>
    /// Adds, keeps or removes the company stop to match whether the run has anything to
    /// do at the warehouse: goods bought for stock to drop off, or supplier-good pieces
    /// sourced from the garage to collect.
    /// </summary>
    /// <remarks>
    /// Two reasons for the same stop, so the condition is an OR and neither may remove it on
    /// its own. Reads the same graph <see cref="SupplierPickupStopReconciler"/> needs — see
    /// its remarks for what has to be loaded.
    /// </remarks>
    public static void Apply(OutgoingShipment shipment, CompanyOptions company)
    {
        var companyStop = shipment.Stops
            .FirstOrDefault(s => s.Kind == OutgoingShipmentStopKind.Company);

        var collectsFromGarage = shipment.Stops
            .Where(s => s.Kind == OutgoingShipmentStopKind.Order && s.ClientOrder is not null)
            .SelectMany(s => s.ClientOrder!.SupplierGoodItems)
            .Any(i => i.QuantityFromGarage > 0);

        if (shipment.StockPurchases.Count == 0 && !collectsFromGarage)
        {
            if (companyStop is not null)
            {
                shipment.Stops.Remove(companyStop);
            }

            return;
        }

        if (companyStop is not null)
        {
            return;
        }

        var lastOrder = shipment.Stops.Count == 0 ? 0 : shipment.Stops.Max(s => s.Order);

        shipment.Stops.Add(new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Company,
            Order = lastOrder + 1,
            Label = company.Name,
            Latitude = company.Latitude,
            Longitude = company.Longitude
        });
    }
}
