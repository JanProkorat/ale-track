using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;

namespace AleTrack.Features.Clients.Utils;

/// <summary>
/// The one place a deviation is written: an upsert per line, never an insert.
/// </summary>
/// <remarks>
/// The failure this exists to prevent is double counting. A dispatcher records "unloaded 7 of
/// 10", reopens the form an hour later and saves again; if the second save appended instead of
/// rewriting, the client would owe six kegs instead of three. Every writer — the recording
/// drawer and the automatic delivery-address ones alike — goes through here, and the partial
/// unique index behind it makes the invariant one that cannot be raced.
///
/// Rows where reality matches the plan are never stored. The ledger holds no no-op rows, so
/// "is there an entry" is the same question as "did something diverge".
/// </remarks>
public static class ClientLedgerWriter
{
    /// <summary>
    /// Records one line, rewriting or deleting the client's existing unresolved entry for it.
    /// Returns the surviving entry, or null when reality matched the plan and nothing is owed.
    /// </summary>
    /// <param name="dbContext">Context to add to and remove from; the caller saves.</param>
    /// <param name="openEntries">
    /// The client's unresolved entries, loaded by the caller. Only unresolved ones may be
    /// rewritten: a settled entry is history and gets a new row beside it, which is exactly
    /// what the partial unique index permits.
    /// </param>
    /// <param name="scope">Who the deviation belongs to, and off which delivery.</param>
    /// <param name="line">The deviation.</param>
    /// <param name="userId">Author, for a new entry.</param>
    /// <param name="now">Write time, for a new entry.</param>
    public static ClientLedgerEntry? Upsert(
        AleTrackDbContext dbContext,
        IReadOnlyCollection<ClientLedgerEntry> openEntries,
        ClientLedgerScope scope,
        ClientLedgerLine line,
        long? userId,
        DateTime now)
    {
        // Money and Other are free rows, not lines: a client legitimately has several open at
        // once ("owes us 500" and "we owe them 300" are two things to settle, not one), so they
        // are appended rather than paired. The index excludes them for the same reason.
        if (IsFreeRow(line.Target))
            return Insert(dbContext, scope, line, userId, now);

        var match = openEntries.FirstOrDefault(e => Pairs(e, scope, line));

        if (IsBackToPlan(match, line))
        {
            if (match is not null)
                dbContext.ClientLedgerEntries.Remove(match);

            return null;
        }

        if (match is null)
            return Insert(dbContext, scope, line, userId, now);

        Overwrite(match, line);
        return match;
    }

    /// <summary>
    /// Whether an entry needs settling rather than being a mere record.
    /// </summary>
    /// <remarks>
    /// Not simply "the numbers differ". Beer and supplier goods delivered over the plan are with
    /// the client and get billed, so nothing is owed either way; a return has no good direction,
    /// because short means the client still owes empties and over means we are holding deposits
    /// that are not ours. An address change is never a debt — the client owes nothing for the
    /// van having driven somewhere else.
    /// </remarks>
    public static bool RequiresFollowUp(ClientLedgerEntryTarget target, int? planned, int? actual) =>
        target switch
        {
            ClientLedgerEntryTarget.DeliveryAddress => false,
            ClientLedgerEntryTarget.ProductQuantity or ClientLedgerEntryTarget.SupplierGoodQuantity =>
                (actual ?? 0) < (planned ?? 0),
            _ => true
        };

    /// <summary>
    /// Targets with no line of their own, appended rather than paired.
    /// </summary>
    public static bool IsFreeRow(ClientLedgerEntryTarget target) =>
        target is ClientLedgerEntryTarget.Money or ClientLedgerEntryTarget.Other;

    /// <summary>
    /// Whether a stored entry is about the same line as the posted one — the same key the
    /// partial unique index is built on, so the two can never disagree.
    /// </summary>
    private static bool Pairs(ClientLedgerEntry entry, ClientLedgerScope scope, ClientLedgerLine line) =>
        entry.Target == line.Target
        && entry.OrderId == scope.OrderId
        && entry.OrderItemId == line.OrderItemId
        && entry.ProductId == line.ProductId
        && entry.SupplierGoodItemId == line.SupplierGoodItemId
        && entry.CustomExtraItemId == line.CustomExtraItemId
        && entry.OrderReturnId == line.OrderReturnId
        && string.Equals(entry.LineName, line.LineName, StringComparison.Ordinal);

    /// <summary>
    /// Whether reality is back where the plan had it, in which case there is nothing to record.
    /// </summary>
    /// <remarks>
    /// For an address the comparison is against the <em>stored</em> original rather than the
    /// posted one. Two redirections are one change of address, so the second save carries the
    /// intermediate value as its "planned" — comparing against that would keep an entry saying
    /// the van went where it was always meant to go.
    /// </remarks>
    private static bool IsBackToPlan(ClientLedgerEntry? match, ClientLedgerLine line)
    {
        if (line.Target == ClientLedgerEntryTarget.DeliveryAddress)
        {
            var original = match?.PlannedText ?? line.PlannedText;
            return string.Equals(original?.Trim(), line.ActualText?.Trim(), StringComparison.Ordinal);
        }

        return line.PlannedQuantity == line.ActualQuantity;
    }

    private static ClientLedgerEntry Insert(
        AleTrackDbContext dbContext,
        ClientLedgerScope scope,
        ClientLedgerLine line,
        long? userId,
        DateTime now)
    {
        var entry = new ClientLedgerEntry
        {
            ClientId = scope.ClientId,
            OrderId = scope.OrderId,
            StopId = scope.StopId,
            Target = line.Target,
            OrderItemId = line.OrderItemId,
            ProductId = line.ProductId,
            ProductName = line.ProductName,
            SupplierGoodItemId = line.SupplierGoodItemId,
            CustomExtraItemId = line.CustomExtraItemId,
            OrderReturnId = line.OrderReturnId,
            LineName = line.LineName,
            PlannedQuantity = line.PlannedQuantity,
            ActualQuantity = line.ActualQuantity,
            PlannedText = line.PlannedText,
            ActualText = line.ActualText,
            Amount = line.Amount,
            Note = line.Note,
            RequiresFollowUp = RequiresFollowUp(line.Target, line.PlannedQuantity, line.ActualQuantity),
            CreatedAt = now,
            CreatedByUserId = userId
        };

        dbContext.ClientLedgerEntries.Add(entry);
        return entry;
    }

    /// <summary>
    /// Rewrites the stored entry from the posted line.
    /// </summary>
    /// <remarks>
    /// The author and the write time are left as they were: the entry is still the same record
    /// of the same event, corrected. <see cref="ClientLedgerEntry.PlannedText"/> is kept for the
    /// reason <see cref="IsBackToPlan"/> explains — the original destination is the interesting
    /// one, not the one it was pointed at in between.
    /// </remarks>
    private static void Overwrite(ClientLedgerEntry entry, ClientLedgerLine line)
    {
        entry.PlannedQuantity = line.PlannedQuantity;
        entry.ActualQuantity = line.ActualQuantity;
        entry.ActualText = line.ActualText;
        entry.Amount = line.Amount;
        entry.Note = line.Note ?? entry.Note;
        entry.ProductName = line.ProductName ?? entry.ProductName;
        entry.RequiresFollowUp = RequiresFollowUp(line.Target, line.PlannedQuantity, line.ActualQuantity);
    }
}
