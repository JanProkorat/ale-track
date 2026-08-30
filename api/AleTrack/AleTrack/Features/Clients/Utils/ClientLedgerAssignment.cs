using System.Globalization;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Utils;

/// <summary>
/// The middle of the three resolution states: an entry an order has promised to settle, but
/// which is not settled yet.
/// </summary>
/// <remarks>
/// Three states, no extra column: open (<c>resolved_at</c> and <c>resolved_by_order_id</c> both
/// null), assigned (the order set, the date not), resolved (the date set).
///
/// The middle one is a safeguard rather than a luxury. Closing the entry the moment somebody
/// clicks "add to order" would make the debt vanish if that order were later cancelled — the
/// exact failure this feature exists to prevent. Promising is not delivering.
/// </remarks>
public static class ClientLedgerAssignment
{
    /// <summary>
    /// Czech, and shown to the operator on the client's profile. The second such site in this
    /// backend after the export labels, for the same reason: it is written on the server rather
    /// than rendered by the client.
    /// </summary>
    private const string SettledByDelivery = "Vyřešeno doručením objednávky";

    /// <summary>
    /// Records which of the client's open entries this order is going to settle. The posted set
    /// is authoritative: an entry dropped from the cart before saving is released again.
    /// </summary>
    /// <remarks>
    /// Assigns only what is the order's to carry — an entry belonging to another client, one
    /// already settled, or one another order is already carrying is left alone. The last of those
    /// is what stops two orders from both promising the same three kegs.
    /// </remarks>
    public static async Task AssignAsync(
        AleTrackDbContext dbContext,
        Order order,
        IReadOnlyCollection<Guid> entryPublicIds,
        CancellationToken ct)
    {
        var clientId = order.ClientId != 0 ? order.ClientId : order.Client?.Id ?? 0;
        if (clientId == 0)
            return;

        var candidates = await dbContext.ClientLedgerEntries
            .Where(e => e.ClientId == clientId
                        && (e.ResolvedAt == null || e.ResolvedByOrderId == order.Id))
            .ToListAsync(ct);

        foreach (var entry in candidates)
        {
            var wanted = entryPublicIds.Contains(entry.PublicId);
            var carriedByThisOrder = entry.ResolvedByOrderId == order.Id;

            if (wanted && entry.ResolvedAt == null && entry.ResolvedByOrderId is null)
            {
                // The navigation, not just the key: an order created in the same save has no key
                // yet, and EF fills the column from the navigation once it does.
                entry.ResolvedByOrder = order;

                if (order.Id != 0)
                    entry.ResolvedByOrderId = order.Id;

                continue;
            }

            // Dropped from the cart before saving: the promise is withdrawn and the entry goes
            // back to being simply open. A settled one is history and stays as it is.
            if (!wanted && carriedByThisOrder && entry.ResolvedAt == null)
            {
                entry.ResolvedByOrder = null;
                entry.ResolvedByOrderId = null;
            }
        }
    }

    /// <summary>
    /// Settles everything the given orders were carrying, because they have now been delivered.
    /// </summary>
    /// <remarks>
    /// Binary by design: an entry assigned to a delivered order closes whole, even if the order
    /// carried less than the debt. That cost is made visible in the order editor, which warns
    /// about the shortfall before saving — the backend closes what it was given.
    /// </remarks>
    public static async Task SettleForDeliveredOrdersAsync(
        AleTrackDbContext dbContext,
        IReadOnlyCollection<Order> orders,
        DateTime now,
        CancellationToken ct)
    {
        if (orders.Count == 0)
            return;

        var orderIds = orders.Select(o => o.Id).ToList();

        var entries = await dbContext.ClientLedgerEntries
            .Where(e => e.ResolvedAt == null && e.ResolvedByOrderId != null && orderIds.Contains(e.ResolvedByOrderId!.Value))
            .ToListAsync(ct);

        foreach (var entry in entries)
        {
            var order = orders.First(o => o.Id == entry.ResolvedByOrderId);
            var deliveredOn = order.ActualDeliveryDate ?? order.RequiredDeliveryDate;

            entry.ResolvedAt = now;
            entry.ResolutionNote = deliveredOn is null
                ? SettledByDelivery
                : $"{SettledByDelivery} {deliveredOn.Value.ToString("d.M.yyyy", CultureInfo.GetCultureInfo("cs-CZ"))}";
        }
    }

    /// <summary>
    /// Puts back among the open points everything a now-cancelled order was carrying.
    /// </summary>
    /// <remarks>
    /// Cancelling the <em>shipment</em> deliberately does not come through here, and this is the
    /// easiest thing in the feature to get backwards: a cancelled run only frees its orders back
    /// to <see cref="Common.Enums.OrderState.New"/> for re-planning. The order still exists and
    /// still carries the debt.
    ///
    /// Only the assignment is undone. An entry the order already settled stays settled: the goods
    /// went out, and cancelling the order afterwards does not un-deliver them.
    /// </remarks>
    public static async Task ReleaseForCancelledOrderAsync(
        AleTrackDbContext dbContext,
        long orderId,
        CancellationToken ct)
    {
        var entries = await dbContext.ClientLedgerEntries
            .Where(e => e.ResolvedByOrderId == orderId && e.ResolvedAt == null)
            .ToListAsync(ct);

        foreach (var entry in entries)
        {
            entry.ResolvedByOrder = null;
            entry.ResolvedByOrderId = null;
        }
    }
}
