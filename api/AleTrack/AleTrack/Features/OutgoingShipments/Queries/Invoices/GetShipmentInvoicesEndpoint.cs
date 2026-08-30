using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Queries.Invoices;

/// <summary>
/// Request to get the invoice split of an outgoing shipment.
/// </summary>
public sealed record GetShipmentInvoicesRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint returning how an outgoing shipment's items are split across invoices.
/// </summary>
/// <remarks>
/// Reconciles before responding, and persists what it changed. The split can go stale without
/// anyone touching the shipment — editing quantities on the underlying order is enough — so
/// materialising here is what keeps stored invoices and stored items from disagreeing.
///
/// That makes this GET a writer, which is unusual but deliberate: the alternative is unstable
/// public IDs for invoices and lines that only exist in memory, which the move and delete
/// endpoints could not then address.
///
/// It is a separate endpoint from the shipment detail on purpose. Nakládka and Fakturace serve
/// different audiences and answer different questions, so they load independently.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="driverScope"></param>
public sealed class GetShipmentInvoicesEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope)
    : Endpoint<GetShipmentInvoicesRequest, ShipmentInvoicesDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("outgoing-shipments/{Id:guid}/invoices");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.View)
            .RequireCapability(Capability.Invoicing)
            .Produces<ShipmentInvoicesDto>()
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(GetShipmentInvoicesEndpoint)));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Retrieves the invoice split of an outgoing shipment";
                s.Responses[StatusCodes.Status200OK] = "Invoice split retrieved";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetShipmentInvoicesRequest req, CancellationToken ct)
    {
        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, req.Id, ct);

        var split = await ShipmentInvoiceGraph.LoadAsync(dbContext, req.Id, ct);
        if (split is null)
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);

        var reconcileResult = ShipmentInvoiceReconciler.Reconcile(split!);

        // Private lines hang off no navigation EF walks, so they are added explicitly.
        if (reconcileResult.AddedPrivateLines.Count > 0)
            dbContext.OutgoingShipmentInvoiceLines.AddRange(reconcileResult.AddedPrivateLines);

        if (reconcileResult.RemovedLines.Count > 0)
            dbContext.OutgoingShipmentInvoiceLines.RemoveRange(reconcileResult.RemovedLines);

        if (reconcileResult.RemovedInvoices.Count > 0)
            dbContext.OutgoingShipmentInvoices.RemoveRange(reconcileResult.RemovedInvoices);

        if (reconcileResult.RemovedRecipients.Count > 0)
            dbContext.OutgoingShipmentInvoiceBillingRecipients.RemoveRange(reconcileResult.RemovedRecipients);

        await dbContext.SaveChangesAsync(ct);

        var deviationCounts = await CountDeviationsAsync(split!, ct);

        await Send.OkAsync(
            ShipmentInvoiceMapper.ToDto(split!, reconcileResult, deviationCounts),
            cancellation: ct);
    }

    /// <summary>
    /// Deviations recorded against each client's order on this run, by internal client ID.
    /// </summary>
    /// <remarks>
    /// A separate read from the split, because the ledger is deliberately not part of it — see
    /// <see cref="ShipmentInvoiceSplit.LedgerEntries"/>. Counted rather than loaded: the screen
    /// needs to know whether a row changed, and the export drawer whether the run did at all. What
    /// each deviation says is read from the client's ledger, where it lives.
    ///
    /// A standalone debt with no order behind it is out, matching the export: it is a fact about the
    /// client, not about this run.
    /// </remarks>
    private async Task<Dictionary<long, int>> CountDeviationsAsync(
        ShipmentInvoiceSplit split,
        CancellationToken ct)
    {
        var orderIds = split.Shipment.Stops
            .Where(stop => stop.ClientOrder is not null)
            .Select(stop => stop.ClientOrder!.Id)
            .ToList();

        if (orderIds.Count == 0)
            return [];

        return await dbContext.ClientLedgerEntries
            .Where(e => e.OrderId != null && orderIds.Contains(e.OrderId.Value))
            .GroupBy(e => e.ClientId)
            .Select(g => new { ClientId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ClientId, x => x.Count, ct);
    }
}
