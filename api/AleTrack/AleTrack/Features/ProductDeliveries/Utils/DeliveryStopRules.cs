using AleTrack.Common.Enums;
using FluentValidation;

namespace AleTrack.Features.ProductDeliveries.Utils;

/// <summary>
/// The shape rules a delivery's stops and their lines have to satisfy, independent of whether the
/// delivery is being created or updated.
/// </summary>
/// <remarks>
/// The create and update payloads are separate types differing only by the stop's PublicId, so
/// their validators cannot share a base class — and every rule here applies identically to both.
/// Written once against plain tuples rather than twice against two DTOs, because a rule tightened
/// on create and forgotten on update is a hole that lets the very shape the check constraints
/// reject reach the database and fail there as a 500.
/// </remarks>
internal static class DeliveryStopRules
{
    /// <summary>
    /// Rejects a delivery that calls at the same brewery, or the same supplier, twice.
    /// </summary>
    /// <remarks>
    /// Two stops at one place are always a mistake in the editor rather than a plan — the products
    /// belong on one stop. Custom stops are exempt: several unnamed waypoints on a route are
    /// perfectly ordinary.
    /// </remarks>
    public static void RejectRepeatedPlaces<T>(
        IEnumerable<(DeliveryStopKind Kind, Guid? BreweryId, Guid? SupplierId)> stops,
        ValidationContext<T> context)
    {
        var materialized = stops.ToList();

        var duplicateBreweryIds = materialized
            .Where(s => s.Kind == DeliveryStopKind.Brewery && s.BreweryId is not null)
            .GroupBy(s => s.BreweryId!.Value)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        if (duplicateBreweryIds.Count > 0)
        {
            context.AddFailure("Stops", $"Nelze zadat více stejných pivovarů: {string.Join(", ", duplicateBreweryIds)}");
        }

        var duplicateSupplierIds = materialized
            .Where(s => s.Kind == DeliveryStopKind.Supplier && s.SupplierId is not null)
            .GroupBy(s => s.SupplierId!.Value)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        if (duplicateSupplierIds.Count > 0)
        {
            context.AddFailure("Stops", $"Nelze zadat více stejných dodavatelů: {string.Join(", ", duplicateSupplierIds)}");
        }
    }

    /// <summary>
    /// Rejects lines that do not belong at a stop of this kind, and lines repeated within it.
    /// </summary>
    /// <remarks>
    /// A line's identity is the triple (product, good, charge kind), not the good alone: the same
    /// bottle as Plnění and as Nájem are two lines at two prices, and collapsing them would silently
    /// drop one of the two things the van is going there for.
    /// </remarks>
    public static void RejectMismatchedLines<T>(
        DeliveryStopKind kind,
        IEnumerable<(Guid? ProductId, Guid? SupplierGoodId, SupplierChargeKind? ChargeKind)> lines,
        ValidationContext<T> context)
    {
        var materialized = lines.ToList();

        switch (kind)
        {
            case DeliveryStopKind.Custom when materialized.Count > 0:
                context.AddFailure("Products", "Vlastní zastávka nemůže obsahovat položky.");
                return;

            case DeliveryStopKind.Brewery when materialized.Any(l => l.SupplierGoodId is not null):
                context.AddFailure("Products", "Zastávka u pivovaru může obsahovat jen produkty pivovaru.");
                return;

            case DeliveryStopKind.Supplier when materialized.Any(l => l.ProductId is not null):
                context.AddFailure("Products", "Zastávka u dodavatele může obsahovat jen zboží dodavatele.");
                return;
        }

        var duplicateProductIds = materialized
            .Where(l => l.ProductId is not null)
            .GroupBy(l => l.ProductId!.Value)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        if (duplicateProductIds.Count > 0)
        {
            context.AddFailure("Products", $"Nelze zadat více stejných produktů: {string.Join(", ", duplicateProductIds)}");
        }

        var duplicateGoods = materialized
            .Where(l => l.SupplierGoodId is not null)
            .GroupBy(l => (l.SupplierGoodId!.Value, l.ChargeKind))
            .Where(g => g.Count() > 1)
            .Select(g => g.Key.Item1)
            .Distinct()
            .ToList();

        if (duplicateGoods.Count > 0)
        {
            context.AddFailure("Products", $"Nelze zadat více stejných položek zboží: {string.Join(", ", duplicateGoods)}");
        }
    }

    /// <summary>
    /// Rejects a line that names neither a product nor a good, both, or a good without the charge
    /// kind its price is read from.
    /// </summary>
    public static void RejectAmbiguousSource<T>(
        Guid? productId,
        Guid? supplierGoodId,
        SupplierChargeKind? chargeKind,
        ValidationContext<T> context)
    {
        if (productId is null == (supplierGoodId is null))
        {
            context.AddFailure("Products", "Položka musí odkazovat na produkt, nebo na zboží dodavatele — právě na jedno z toho.");
            return;
        }

        if (supplierGoodId is not null && chargeKind is null)
        {
            context.AddFailure("Products", "U zboží dodavatele je nutné uvést druh ceny.");
        }

        if (supplierGoodId is null && chargeKind is not null)
        {
            context.AddFailure("Products", "Druh ceny lze uvést jen u zboží dodavatele.");
        }
    }
}
