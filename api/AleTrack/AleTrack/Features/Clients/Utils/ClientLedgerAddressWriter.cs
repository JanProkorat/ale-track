using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Utils;

/// <summary>
/// Records a change of destination in the client's ledger. Shared by the two write paths that
/// can move a delivery, so the dispatcher never has to type it and never types it twice.
/// </summary>
/// <remarks>
/// There are two of them and they are the same event to the client: the order's address is
/// edited and propagates to the stop, or the planner moves the stop on the run itself. The
/// second is the commoner one — it is what happens when a client rings mid-run to say they
/// cannot make it — and it stamped nothing at all before this.
///
/// What the ledger adds over <c>AddressChangedBanner</c>, which keeps working untouched, is the
/// value the address had before.
///
/// Nothing is written while the run is still <see cref="OutgoingShipmentState.Created"/>. Until
/// it leaves, moving a stop is planning: nothing has been promised to anyone, and logging every
/// drag of the route would bury the changes that matter.
/// </remarks>
public static class ClientLedgerAddressWriter
{
    /// <summary>
    /// Whether a stop's address change is worth recording — i.e. whether anything had been
    /// promised yet.
    /// </summary>
    public static bool IsRecordable(OutgoingShipmentState state) =>
        state is not (OutgoingShipmentState.Created
            or OutgoingShipmentState.Delivered
            or OutgoingShipmentState.Cancelled);

    /// <summary>
    /// Records that a stop's destination moved from <paramref name="before"/> to
    /// <paramref name="after"/>. Upserted like every other deviation, so a second redirection of
    /// the same stop stays one change of address — and moving it back deletes the entry.
    /// </summary>
    public static async Task RecordAsync(
        AleTrackDbContext dbContext,
        Order order,
        OutgoingShipmentStop stop,
        string? before,
        string? after,
        long? userId,
        DateTime now,
        CancellationToken ct)
    {
        if (string.Equals(before?.Trim(), after?.Trim(), StringComparison.Ordinal))
            return;

        // A destination that cannot be rendered at all — a client with no address left — is not
        // a move to record. The comparison above already covers the commoner no-op: a stop the
        // planner had overridden keeps its own address when the order's changes, so nothing
        // moved for the client.
        if (after is null)
            return;

        var clientId = order.ClientId != 0 ? order.ClientId : order.Client?.Id ?? 0;
        if (clientId == 0)
            return;

        var openEntries = await dbContext.ClientLedgerEntries
            .Where(e => e.ClientId == clientId
                        && e.ResolvedAt == null
                        && e.OrderId == order.Id
                        && e.Target == ClientLedgerEntryTarget.DeliveryAddress)
            .ToListAsync(ct);

        ClientLedgerWriter.Upsert(
            dbContext,
            openEntries,
            new ClientLedgerScope(clientId, order.Id, stop.Id == 0 ? null : stop.Id),
            new ClientLedgerLine
            {
                Target = ClientLedgerEntryTarget.DeliveryAddress,
                PlannedText = before,
                ActualText = after
            },
            userId,
            now);
    }
}
