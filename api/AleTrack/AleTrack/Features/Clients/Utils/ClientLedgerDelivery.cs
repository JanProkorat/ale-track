using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Features.Clients.Utils;

/// <summary>
/// What was actually delivered on a line — the lookup the inline diffs and the invoice both use.
/// </summary>
/// <remarks>
/// Deliberately blind to <see cref="ClientLedgerEntry.ResolvedAt"/>, and that is the whole point.
/// What came off the van is a permanent fact about that handover; whether the relationship was
/// later squared is a different question, answered by the open-points lookup the upsert and the
/// client profile use.
///
/// Conflating the two is the silent failure this feature was designed around: filtering the
/// display by resolution would restore the plan on screen, and filtering the <em>invoice</em> by
/// it would bill seven pieces now and ten again later. Seven of ten delivered means an invoice for
/// seven, and it stays seven forever; the three that follow are billed on the order that brings
/// them.
///
/// One entry per line, never a sum: a line may carry a settled entry and a newer open one, and
/// adding their deltas together would count the same shortfall twice. The open one wins because
/// it is the current truth; a settled one is the fallback for a line nobody has touched since.
/// </remarks>
public static class ClientLedgerDelivery
{
    /// <summary>
    /// The entry recording what changed hands on a beer line.
    /// </summary>
    public static ClientLedgerEntry? ForOrderItem(IEnumerable<ClientLedgerEntry> entries, long orderItemId) =>
        Pick(entries.Where(e => e.Target == ClientLedgerEntryTarget.ProductQuantity
                                && e.OrderItemId == orderItemId));

    /// <summary>
    /// The entry recording what changed hands on a supplier-good line.
    /// </summary>
    public static ClientLedgerEntry? ForSupplierGoodItem(IEnumerable<ClientLedgerEntry> entries, long itemId) =>
        Pick(entries.Where(e => e.Target == ClientLedgerEntryTarget.SupplierGoodQuantity
                                && e.SupplierGoodItemId == itemId));

    /// <summary>
    /// The entry recording what changed hands on a custom extra line.
    /// </summary>
    public static ClientLedgerEntry? ForCustomExtraItem(IEnumerable<ClientLedgerEntry> entries, long itemId) =>
        Pick(entries.Where(e => e.Target == ClientLedgerEntryTarget.CustomExtraQuantity
                                && e.CustomExtraItemId == itemId));

    /// <summary>
    /// Products the client took at the door: recorded against a product but against no order
    /// line, because the order never planned them.
    /// </summary>
    /// <remarks>
    /// One per order and product, picked by the same rule — otherwise a line with both a settled
    /// entry and a newer open one would be billed twice.
    /// </remarks>
    public static IEnumerable<ClientLedgerEntry> DoorSideProducts(IEnumerable<ClientLedgerEntry> entries) =>
        entries
            .Where(e => e.Target == ClientLedgerEntryTarget.ProductQuantity
                        && e.OrderItemId is null
                        && e.ProductId is not null
                        && e.OrderId is not null)
            .GroupBy(e => (e.OrderId, e.ProductId))
            .Select(g => Pick(g)!)
            .Where(e => (e.ActualQuantity ?? 0) - (e.PlannedQuantity ?? 0) > 0);

    /// <summary>
    /// The planned quantity adjusted by what the line's entry recorded, never below zero.
    /// </summary>
    /// <remarks>
    /// The <em>delta</em> is applied to the plan rather than the entry's actual being taken
    /// wholesale, because the two planned figures need not agree: once the run has left, the
    /// recording form measures against what was loaded, which a rampside top-up can push above
    /// what the order says. The order stays the thing being billed; the deviation adjusts it.
    /// </remarks>
    public static int Effective(int planned, ClientLedgerEntry? entry)
    {
        if (entry?.ActualQuantity is null || entry.PlannedQuantity is null)
            return planned;

        return Math.Max(0, planned + (entry.ActualQuantity.Value - entry.PlannedQuantity.Value));
    }

    /// <summary>
    /// The open entry for a line, or the most recent settled one when nothing is open.
    /// </summary>
    private static ClientLedgerEntry? Pick(IEnumerable<ClientLedgerEntry> candidates) =>
        candidates
            .OrderBy(e => e.ResolvedAt is not null)
            .ThenByDescending(e => e.CreatedAt)
            .ThenByDescending(e => e.Id)
            .FirstOrDefault();
}
