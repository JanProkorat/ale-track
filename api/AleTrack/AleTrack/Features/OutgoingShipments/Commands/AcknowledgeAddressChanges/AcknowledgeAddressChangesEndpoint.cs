using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.AcknowledgeAddressChanges;

/// <summary>
/// Clears the pending delivery-address-change stamp on every stop of a
/// shipment — the "Rozumím" action behind the banner. Separate from the
/// shipment update because the read-only detail screen must be able to dismiss
/// the notice without saving the whole shipment.
/// </summary>
/// <remarks>
/// Deliberately <see cref="EndpointWithoutRequest"/> rather than a request DTO
/// holding just the route ID: on POST, FastEndpoints binds a request DTO from
/// the body and answers 415 when the caller sends none — which the generated
/// client does, because a route-only DTO produces no request body in the
/// OpenAPI document. Nothing about this call needs a body. Same reasoning as
/// <c>AddPurchaseInvoiceEndpoint</c>, which hit this first.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="driverScope"></param>
public sealed class AcknowledgeAddressChangesEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope)
    : EndpointWithoutRequest
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("outgoing-shipments/{Id:guid}/acknowledge-address-changes");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(AcknowledgeAddressChangesEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Dismisses the delivery-address-change notice on a shipment";
            s.Responses[StatusCodes.Status204NoContent] = "Notice dismissed";
            s.SetNotFoundResponse("OutgoingShipment");
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var shipmentId = Route<Guid>("Id");

        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, shipmentId, ct);

        var shipment = await dbContext.OutgoingShipments
            .Include(s => s.Stops)
            .FirstOrDefaultAsync(s => s.PublicId == shipmentId, ct);

        if (shipment is null)
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), shipmentId);

        foreach (var stop in shipment!.Stops)
            stop.AddressChangedAt = null;

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
