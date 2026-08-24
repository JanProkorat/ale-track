using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Queries.Ledger;

/// <summary>
/// Which of a client's ledger entries to read.
/// </summary>
public enum ClientLedgerQueryState
{
    /// <summary>Unresolved only — the open points, including the ones an order already carries.</summary>
    Open = 0,

    /// <summary>Everything, settled entries included.</summary>
    All = 1
}

/// <summary>
/// Request for a client's ledger.
/// </summary>
public sealed record GetClientLedgerEntriesRequest
{
    /// <summary>Public ID of the client.</summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Whether to return only what is still open. Defaults to everything.
    /// </summary>
    [QueryParam]
    public ClientLedgerQueryState State { get; set; } = ClientLedgerQueryState.All;
}

/// <summary>
/// Reads a client's ledger — what happened differently, open and settled.
/// </summary>
/// <remarks>
/// <see cref="ClientLedgerQueryState.Open"/> is for deciding what still has to be done: the
/// client profile's Nedořešeno section, the order editor's preview, and the upsert. It is
/// deliberately <em>not</em> what the inline diffs read. What was delivered on a line is a
/// permanent fact about that handover regardless of whether the relationship was later settled,
/// so filtering the diffs by resolution would restore the plan on screen — and bill the pieces
/// already billed short a second time.
/// </remarks>
public sealed class GetClientLedgerEntriesEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetClientLedgerEntriesRequest, List<ClientLedgerEntryDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("clients/{id:guid}/ledger-entries");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.View)
            .WithName(nameof(GetClientLedgerEntriesEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets a client's ledger of deviations";
            s.Responses[StatusCodes.Status200OK] = "The client's ledger entries, newest first";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientLedgerEntriesRequest req, CancellationToken ct)
    {
        var query = dbContext.ClientLedgerEntries.Where(e => e.Client.PublicId == req.Id);

        if (req.State == ClientLedgerQueryState.Open)
            query = query.Where(e => e.ResolvedAt == null);

        var entries = await query
            .OrderByDescending(e => e.CreatedAt)
            .ThenByDescending(e => e.Id)
            .Select(e => new ClientLedgerEntryDto
            {
                Id = e.PublicId,
                Target = e.Target,
                OrderId = e.Order != null ? e.Order.PublicId : null,
                OrderRequiredDeliveryDate = e.Order != null ? e.Order.RequiredDeliveryDate : null,
                StopId = e.Stop != null ? e.Stop.PublicId : null,
                OrderItemId = e.OrderItem != null ? e.OrderItem.PublicId : null,
                ProductId = e.Product != null ? e.Product.PublicId : null,
                ProductName = e.ProductName,
                SupplierGoodItemId = e.SupplierGoodItem != null ? e.SupplierGoodItem.PublicId : null,
                CustomExtraItemId = e.CustomExtraItem != null ? e.CustomExtraItem.PublicId : null,
                OrderReturnId = e.OrderReturn != null ? e.OrderReturn.PublicId : null,
                LineName = e.LineName,
                PlannedQuantity = e.PlannedQuantity,
                ActualQuantity = e.ActualQuantity,
                PlannedText = e.PlannedText,
                ActualText = e.ActualText,
                Amount = e.Amount,
                Note = e.Note,
                RequiresFollowUp = e.RequiresFollowUp,
                ResolvedAt = e.ResolvedAt,
                ResolutionNote = e.ResolutionNote,
                ResolvedByOrderId = e.ResolvedByOrder != null ? e.ResolvedByOrder.PublicId : null,
                CreatedAt = e.CreatedAt,
                CreatedByUserName = e.CreatedByUser != null ? e.CreatedByUser.UserName : null,
                ResolvedByUserName = e.ResolvedByUser != null ? e.ResolvedByUser.UserName : null
            })
            .ToListAsync(ct);

        await Send.OkAsync(entries, cancellation: ct);
    }
}
