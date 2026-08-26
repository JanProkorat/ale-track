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
    /// The column holding whatever the other invoices do not claim. Never stores lines.
    /// </summary>
    public const int RemainderSequence = 1;

    /// <summary>
    /// Loads a shipment with everything the purchase split needs, tracked. Null when it does
    /// not exist.
    /// </summary>
    public static async Task<OutgoingShipment?> LoadAsync(AleTrackDbContext dbContext, Guid shipmentId, CancellationToken ct) =>
        await dbContext.OutgoingShipments
            .Include(s => s.Stops).ThenInclude(st => st.ClientOrder!).ThenInclude(o => o.OrderItems).ThenInclude(i => i.Product)
            .Include(s => s.StockPurchases).ThenInclude(p => p.Product)
            .Include(s => s.PurchaseInvoices).ThenInclude(i => i.Lines)
            .Include(s => s.LoadingStates)
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
    /// How many pieces of a product each invoice column carries, indexed by sequence.
    /// </summary>
    /// <remarks>
    /// Column 1 gets the remainder <em>plus</em> the pieces taken from our own garage: those are
    /// on no brewery invoice, but they are in the van and have to be loaded like everything else.
    /// The invoice columns show only what is bought, so the two figures differ on purpose — this
    /// one answers "is there anything here to load", not "what is billed".
    /// </remarks>
    public static Dictionary<int, int> PiecesByColumn(OutgoingShipment shipment, long productId)
    {
        var columns = new Dictionary<int, int>();
        var sequences = shipment.PurchaseInvoices.Select(i => i.Sequence).DefaultIfEmpty(1).Max();

        for (var sequence = 1; sequence <= Math.Max(sequences, 1); sequence++)
            columns[sequence] = 0;

        foreach (var invoice in LineHolders(shipment))
            columns[invoice.Sequence] = invoice.Lines.Where(l => l.ProductId == productId).Sum(l => l.Quantity);

        var claimed = columns.Where(c => c.Key > 1).Sum(c => c.Value);
        var fromGarage = shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .SelectMany(s => s.ClientOrder!.OrderItems)
            .Where(i => i.ProductId == productId)
            .Sum(i => i.QuantityFromInventory);

        columns[1] = Math.Max(0, PurchasedByProduct(shipment).GetValueOrDefault(productId) - claimed) + fromGarage;

        return columns;
    }

    /// <summary>
    /// The column whose second count blocks moving pieces in or out of the invoice at
    /// <paramref name="sequence"/>: that column itself, or the remainder column it takes its
    /// pieces from. Null while neither has been checked.
    /// </summary>
    /// <remarks>
    /// A line write on a later invoice always moves pieces between it and the remainder, so both
    /// ends have to be open — writing to F2 once F1 is checked would silently change a pallet
    /// somebody has already counted twice. Clearing either state back to dictated reopens it.
    /// </remarks>
    public static int? CheckedBlocker(OutgoingShipment shipment, long productId, int sequence)
    {
        foreach (var column in new[] { RemainderSequence, sequence })
        {
            if (shipment.LoadingStates.Any(s =>
                    s.ProductId == productId && s.Sequence == column && s.State == ShipmentLoadingState.Checked))
                return column;
        }

        return null;
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
