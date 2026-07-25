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
/// On a shipment that has none yet this creates <em>two</em>: the remainder invoice (sequence 1,
/// which never stores lines) and the first invoice that can hold them. One click has to produce a
/// visible split, and a lone remainder invoice would be a column with nothing to put in it.
///
/// Deliberately <see cref="EndpointWithoutRequest"/> rather than a request DTO holding just the
/// route ID: on POST, FastEndpoints binds a request DTO from the body and answers 415 when the
/// caller sends none — which the generated client does, because a route-only DTO produces no
/// request body in the OpenAPI document. Nothing about this call needs a body.
/// </remarks>
/// <param name="dbContext"></param>
public sealed class AddPurchaseInvoiceEndpoint(AleTrackDbContext dbContext) : EndpointWithoutRequest
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("outgoing-shipments/{Id:guid}/purchase-invoices");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
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

        if (shipment.PurchaseInvoices.Count == 0)
            AppendInvoice(shipment);

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
