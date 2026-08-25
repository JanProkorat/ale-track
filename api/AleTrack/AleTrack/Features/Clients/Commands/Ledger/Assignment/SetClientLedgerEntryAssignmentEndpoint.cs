using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Commands.Ledger.Assignment;

/// <summary>
/// Which order promises to settle this entry, or none.
/// </summary>
public sealed record SetClientLedgerEntryAssignmentDto
{
    /// <summary>The order taking it on. Null releases the entry back to simply being open.</summary>
    public Guid? OrderId { get; set; }
}

/// <summary>
/// Request to hand one open deviation to an order, or to take it back.
/// </summary>
public sealed record SetClientLedgerEntryAssignmentRequest
{
    /// <summary>Public ID of the entry.</summary>
    public Guid Id { get; set; }

    /// <summary>Body of the request.</summary>
    [FromBody]
    public SetClientLedgerEntryAssignmentDto Data { get; set; } = null!;
}

/// <summary>
/// Records that an order will settle an open deviation — the promise, not the settling.
/// </summary>
/// <remarks>
/// The order editor makes the same promise for a whole cart through <c>SettledLedgerEntryIds</c>;
/// this is the one-entry version, for the order screen's own list of what the client still has
/// open. Both leave the closing to <see cref="ClientLedgerAssignment.SettleForDeliveredOrdersAsync"/>,
/// which runs when the run actually arrives: promising is not delivering, and an entry closed on
/// the promise would be closed even if the order were cancelled.
/// </remarks>
public sealed class SetClientLedgerEntryAssignmentEndpoint(AleTrackDbContext dbContext)
    : Endpoint<SetClientLedgerEntryAssignmentRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("clients/ledger-entries/{Id:guid}/assignment");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .Produces<FailureResponse>(StatusCodes.Status409Conflict)
            .WithName(nameof(SetClientLedgerEntryAssignmentEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Hands an open deviation to an order, or takes it back";
            s.Responses[StatusCodes.Status204NoContent] = "Assignment set";
            s.Responses[StatusCodes.Status404NotFound] = "Entry or order not found";
            s.Responses[StatusCodes.Status409Conflict] = "Entry is settled, or another order carries it";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetClientLedgerEntryAssignmentRequest req, CancellationToken ct)
    {
        var entry = await dbContext.ClientLedgerEntries.FirstOrDefaultAsync(e => e.PublicId == req.Id, ct);
        if (entry is null)
            ThrowHelper.PublicEntityNotFound(nameof(ClientLedgerEntry), req.Id);

        // A settled entry is history. Reopening it is the resolution endpoint's job, and doing
        // both here would let one click undo a close nobody asked to undo.
        if (entry!.ResolvedAt is not null)
            ThrowHelper.LedgerEntryAlreadyResolved(req.Id);

        if (req.Data.OrderId is null)
        {
            entry.ResolvedByOrderId = null;
            await dbContext.SaveChangesAsync(ct);
            await Send.NoContentAsync(ct);
            return;
        }

        var order = await dbContext.Orders
            .FirstOrDefaultAsync(o => o.PublicId == req.Data.OrderId.Value, ct);

        if (order is null)
            ThrowHelper.PublicEntityNotFound(nameof(Entities.Order), req.Data.OrderId.Value);

        // The entry is the client's business, so only that client's orders may take it on.
        if (order!.ClientId != entry.ClientId)
            ThrowHelper.LedgerEntryClientMismatch(req.Id, req.Data.OrderId.Value);

        // Two orders promising the same three kegs is the one thing this must not allow: the
        // first to arrive would close the entry and the second would be carrying nothing.
        if (entry.ResolvedByOrderId is not null && entry.ResolvedByOrderId != order.Id)
            ThrowHelper.LedgerEntryAlreadyAssigned(req.Id);

        entry.ResolvedByOrderId = order.Id;

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
