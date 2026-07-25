using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Loading, totals and clamping for the split of a shipment across the invoices the
/// <em>brewery issues to us</em>.
/// </summary>
/// <remarks>
/// Deliberately much smaller than <see cref="ShipmentInvoiceReconciler"/>, and for a structural
/// reason: purchase-invoice lines are keyed by product and the first invoice is a computed
/// remainder, so there is no default split to materialise and no precedence question when
/// quantities shrink. Keeping every stored line within its product's purchased total is the
/// whole invariant.
/// </remarks>
public static class PurchaseInvoiceSplit
{
    /// <summary>
    /// Loads a shipment with everything the purchase split needs, tracked. Null when it does
    /// not exist.
    /// </summary>
    public static async Task<OutgoingShipment?> LoadAsync(AleTrackDbContext dbContext, Guid shipmentId, CancellationToken ct) =>
        await dbContext.OutgoingShipments
            .Include(s => s.Stops).ThenInclude(st => st.ClientOrder!).ThenInclude(o => o.OrderItems).ThenInclude(i => i.Product)
            .Include(s => s.StockPurchases).ThenInclude(p => p.Product)
            .Include(s => s.PurchaseInvoices).ThenInclude(i => i.Lines)
            .FirstOrDefaultAsync(s => s.PublicId == shipmentId, ct);

    /// <summary>
    /// Whether the split may still be edited. Mirrors the nakládka rule.
    /// </summary>
    public static bool IsEditable(OutgoingShipment shipment) =>
        shipment.State is not (OutgoingShipmentState.Delivered or OutgoingShipmentState.Cancelled);

    /// <summary>
    /// How many pieces of each product this run actually buys from a brewery, keyed by product ID.
    /// </summary>
    /// <remarks>
    /// Ordered pieces sourced from our own stock are excluded: they were bought on an earlier run
    /// and invoiced then, so putting them on this run's purchase invoice would double-count.
    /// Stock purchases ("Zboží na sklad") are included — they are bought here like anything else.
    /// </remarks>
    public static Dictionary<long, int> PurchasedByProduct(OutgoingShipment shipment)
    {
        var totals = new Dictionary<long, int>();

        foreach (var item in shipment.Stops.Where(s => s.ClientOrder is not null).SelectMany(s => s.ClientOrder!.OrderItems))
        {
            var fromBrewery = item.Quantity - item.QuantityFromInventory;
            if (fromBrewery <= 0)
                continue;

            totals[item.ProductId] = totals.GetValueOrDefault(item.ProductId) + fromBrewery;
        }

        foreach (var purchase in shipment.StockPurchases)
            totals[purchase.ProductId] = totals.GetValueOrDefault(purchase.ProductId) + purchase.Quantity;

        return totals;
    }

    /// <summary>
    /// Invoices that may hold lines — everything above the remainder invoice.
    /// </summary>
    public static IEnumerable<OutgoingShipmentPurchaseInvoice> LineHolders(OutgoingShipment shipment) =>
        shipment.PurchaseInvoices.Where(i => i.Sequence > 1);

    /// <summary>
    /// The largest quantity of <paramref name="productId"/> that <paramref name="invoice"/> may
    /// claim: what the run buys, minus what the other invoices already claim.
    /// </summary>
    public static int CapFor(OutgoingShipment shipment, OutgoingShipmentPurchaseInvoice invoice, long productId)
    {
        var purchased = PurchasedByProduct(shipment).GetValueOrDefault(productId);

        // Reference comparison, not Id: an invoice added in this request has Id 0, as does
        // every other unsaved one, so comparing keys would exclude the wrong rows.
        var claimedElsewhere = LineHolders(shipment)
            .Where(i => !ReferenceEquals(i, invoice))
            .SelectMany(i => i.Lines)
            .Where(l => l.ProductId == productId)
            .Sum(l => l.Quantity);

        return Math.Max(0, purchased - claimedElsewhere);
    }

    /// <summary>
    /// Brings every stored line back inside its product's purchased total and drops the ones
    /// left with nothing, returning the lines the caller must delete.
    /// </summary>
    /// <remarks>
    /// Runs on read as well as on write: the nakládka changes through endpoints that know
    /// nothing about this split (an order item's quantity, its sourcing, a stock purchase), so
    /// a stored line can fall out of range without anything here being called.
    ///
    /// Invoices are walked in <see cref="OutgoingShipmentPurchaseInvoice.Sequence"/> order, so
    /// when a product's total shrinks the later invoices give up their claim first and the
    /// earlier ones keep theirs.
    /// </remarks>
    public static List<OutgoingShipmentPurchaseInvoiceLine> Clamp(OutgoingShipment shipment)
    {
        var purchased = PurchasedByProduct(shipment);
        var remaining = new Dictionary<long, int>(purchased);
        var removed = new List<OutgoingShipmentPurchaseInvoiceLine>();

        foreach (var invoice in LineHolders(shipment).OrderBy(i => i.Sequence))
        {
            foreach (var line in invoice.Lines.ToList())
            {
                var left = remaining.GetValueOrDefault(line.ProductId);
                var allowed = Math.Min(line.Quantity, left);

                if (allowed <= 0)
                {
                    invoice.Lines.Remove(line);
                    removed.Add(line);
                    continue;
                }

                line.Quantity = allowed;
                remaining[line.ProductId] = left - allowed;
            }
        }

        return removed;
    }

    /// <summary>
    /// Next free sequence on the shipment.
    /// </summary>
    public static int NextSequence(OutgoingShipment shipment) =>
        shipment.PurchaseInvoices.Count == 0 ? 1 : shipment.PurchaseInvoices.Max(i => i.Sequence) + 1;

    /// <summary>
    /// The invoice at <paramref name="sequence"/>, creating it and any gap below it.
    /// </summary>
    /// <remarks>
    /// The table shows two invoice columns from the start, so the second one is usually written
    /// to before it exists. Creating on write rather than on read keeps runs that never split
    /// free of empty rows.
    /// </remarks>
    public static OutgoingShipmentPurchaseInvoice EnsureSequence(OutgoingShipment shipment, int sequence)
    {
        while (NextSequence(shipment) <= sequence)
            shipment.PurchaseInvoices.Add(new OutgoingShipmentPurchaseInvoice
            {
                PublicId = Guid.NewGuid(),
                OutgoingShipment = shipment,
                Sequence = NextSequence(shipment)
            });

        return shipment.PurchaseInvoices.Single(i => i.Sequence == sequence);
    }
}
