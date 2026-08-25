using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.FileInvoicing;

/// <summary>
/// Request to file a run's invoicing.
/// </summary>
public sealed record FileShipmentInvoicingRequest
{
    /// <summary>Public ID of the outgoing shipment.</summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Files the run's invoicing: the one-way door between correcting orders and recording deviations.
/// </summary>
/// <remarks>
/// Up to here the office moves freely — a row is marked finished and unmarked again, an order is
/// corrected the ordinary way, the export is taken afresh. Filing ends that: the orders of this
/// run close (see <c>OrderMutability</c>), the readiness marks lock, and only now can a deviation
/// be recorded against what was delivered. Nothing undoes it, which is why the user who did it is
/// stored with the timestamp.
///
/// Allowed in every state but <see cref="OutgoingShipmentState.Cancelled"/> —
/// <see cref="OutgoingShipmentState.Delivered"/> included, because a run marked delivered before
/// the paperwork was closed would otherwise be able neither to file nor ever to record.
/// </remarks>
public sealed class FileShipmentInvoicingEndpoint(AleTrackDbContext dbContext, IAppContext appContext)
    : Endpoint<FileShipmentInvoicingRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}/invoicing/filed");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .RequireCapability(Capability.Invoicing)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .Produces<FailureResponse>(StatusCodes.Status409Conflict)
            .WithName(nameof(FileShipmentInvoicingEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Files the run's invoicing, closing its orders for good";
            s.Responses[StatusCodes.Status204NoContent] = "Invoicing filed";
            s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment not found";
            s.Responses[StatusCodes.Status409Conflict] =
                "The run is cancelled, or some of its invoice rows are not finished";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FileShipmentInvoicingRequest req, CancellationToken ct)
    {
        var split = await ShipmentInvoiceGraph.LoadAsync(dbContext, req.Id, ct);
        if (split is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);
            return;
        }

        var shipment = split.Shipment;

        if (shipment.State is OutgoingShipmentState.Cancelled)
            ThrowHelper.ShipmentInvoicingNotFileable(req.Id);

        // Pressing it twice is not an error: the run is filed either way, and this is a PUT of a
        // state rather than an event.
        if (shipment.IsInvoicingFiled)
        {
            await Send.NoContentAsync(ct);
            return;
        }

        // Every row first. Filing over an unfinished row would lock that order out of both
        // worlds: no longer editable, and never markable either.
        var unfinished = ShipmentInvoiceGraph.RowClientIds(split)
            .Count(clientId => !shipment.InvoiceConfirmations.Any(c => c.ClientId == clientId && c.IsReady));

        if (unfinished > 0)
            ThrowHelper.ShipmentInvoicingIncomplete(unfinished);

        shipment.InvoicingFiledAt = DateTime.UtcNow;
        shipment.InvoicingFiledByUserId = await ResolveCurrentUserIdAsync(ct);

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }

    private async Task<long?> ResolveCurrentUserIdAsync(CancellationToken ct)
    {
        if (appContext.UserId is null)
            return null;

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.PublicId == appContext.UserId, ct);

        return user?.Id;
    }
}
