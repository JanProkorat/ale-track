using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Keeps exactly one <see cref="OutgoingShipmentStopKind.Company"/> stop on a run
/// for as long as it carries goods bought for our own warehouse.
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
    /// Adds, keeps or removes the company stop to match whether the run has any
    /// stock purchases.
    /// </summary>
    public static void Apply(OutgoingShipment shipment, CompanyOptions company)
    {
        var companyStop = shipment.Stops
            .FirstOrDefault(s => s.Kind == OutgoingShipmentStopKind.Company);

        if (shipment.StockPurchases.Count == 0)
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
