using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;

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

        if (reconcileResult.RemovedLines.Count > 0)
            dbContext.OutgoingShipmentInvoiceLines.RemoveRange(reconcileResult.RemovedLines);

        if (reconcileResult.RemovedInvoices.Count > 0)
            dbContext.OutgoingShipmentInvoices.RemoveRange(reconcileResult.RemovedInvoices);

        await dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(ShipmentInvoiceMapper.ToDto(split!, reconcileResult), cancellation: ct);
    }
}
