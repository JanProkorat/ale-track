using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;

namespace AleTrack.Features.OutgoingShipments.Commands.AddPurchaseInvoice;

/// <summary>
/// Endpoint opening another invoice the brewery issues to us for this shipment.
/// </summary>
/// <remarks>
/// The nakládka always shows two invoice columns, whether or not anything is stored behind them,
/// so "add one" means going past those two: the shipment ends up with
/// <c>max(current, 2) + 1</c> invoices. From nothing that is three; from three, four.
///
/// Writing into one of the two default columns needs no call here — the line endpoint
/// materialises invoices 1 and 2 on first use.
///
/// Deliberately <see cref="EndpointWithoutRequest"/> rather than a request DTO holding just the
/// route ID: on POST, FastEndpoints binds a request DTO from the body and answers 415 when the
/// caller sends none — which the generated client does, because a route-only DTO produces no
/// request body in the OpenAPI document. Nothing about this call needs a body.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="driverScope"></param>
public sealed class AddPurchaseInvoiceEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope)
    : EndpointWithoutRequest
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("outgoing-shipments/{Id:guid}/purchase-invoices");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .RequireCapability(Capability.Invoicing)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(AddPurchaseInvoiceEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Adds another brewery invoice to an outgoing shipment";
                s.Responses[StatusCodes.Status204NoContent] = "Invoice added";
                s.Responses[StatusCodes.Status400BadRequest] = "Shipment no longer editable";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var shipmentId = Route<Guid>("Id");

        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, shipmentId, ct);

        var shipment = await PurchaseInvoiceSplit.LoadAsync(dbContext, shipmentId, ct);
        if (shipment is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), shipmentId);
            return;
        }

        if (!PurchaseInvoiceSplit.IsEditable(shipment))
        {
            ThrowHelper.BadRequest($"Purchase invoices of a {shipment.State} shipment can no longer be changed.");
            return;
        }

        // Past the two columns the table always shows — see the remarks above.
        var target = Math.Max(shipment.PurchaseInvoices.Count, 2) + 1;
        while (shipment.PurchaseInvoices.Count < target)
            AppendInvoice(shipment);

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }

    private static void AppendInvoice(OutgoingShipment shipment) =>
        shipment.PurchaseInvoices.Add(new OutgoingShipmentPurchaseInvoice
        {
            PublicId = Guid.NewGuid(),
            OutgoingShipment = shipment,
            Sequence = PurchaseInvoiceSplit.NextSequence(shipment)
        });
}
