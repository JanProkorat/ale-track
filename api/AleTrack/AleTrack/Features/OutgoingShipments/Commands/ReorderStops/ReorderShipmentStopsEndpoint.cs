using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.ReorderStops;

/// <summary>
/// The run's stops in their new sequence.
/// </summary>
public sealed record ReorderShipmentStopsDto
{
    /// <summary>
    /// Public IDs of every stop on the run, in the order they should be driven.
    /// </summary>
    /// <remarks>
    /// The whole set, not a patch: a sequence is only meaningful as a whole, and accepting a
    /// subset would leave the endpoint guessing where the omitted stops belong. The handler
    /// rejects a list that is not exactly the run's own stops.
    /// </remarks>
    public List<Guid> StopIds { get; set; } = [];
}

/// <summary>
/// Request to resequence one shipment's stops.
/// </summary>
public sealed record ReorderShipmentStopsRequest
{
    /// <summary>Public ID of the outgoing shipment.</summary>
    public Guid Id { get; set; }

    /// <summary>The new sequence.</summary>
    [FromBody]
    public ReorderShipmentStopsDto Data { get; set; } = null!;
}

/// <summary>
/// Validator for <see cref="ReorderShipmentStopsRequest"/>.
/// </summary>
public sealed class ReorderShipmentStopsValidator : Validator<ReorderShipmentStopsRequest>
{
    public ReorderShipmentStopsValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data.StopIds).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
    }
}

/// <summary>
/// Endpoint writing a new stop sequence for one shipment.
/// </summary>
/// <remarks>
/// Its own narrow endpoint rather than the full shipment PUT, for the reason the sourcing
/// endpoints have one: moving a stop one place is a single click, and re-posting the whole run —
/// orders, addresses, via points, stock purchases, checklist — to change two integers made every
/// click wait on a whole-shipment rebuild, with the address-diffing and reconciliation that
/// comes with it.
///
/// It is also the only way to move an auto-derived stop. The editor deliberately keeps supplier
/// pickup stops out of its draft (they would be echoed back as custom stops and duplicated), so
/// without this a planner could not place one in the route at all.
///
/// Sequence is content: it feeds the export, the unload list and the invoice ordering, and the
/// content snapshot written when the truck is packed depends on it. So it follows the same
/// freeze as every other content edit — <see cref="ShipmentMutability.IsContentEditable"/>.
/// </remarks>
public sealed class ReorderShipmentStopsEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope)
    : Endpoint<ReorderShipmentStopsRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}/stops/order");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(ReorderShipmentStopsEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Reorders a shipment's stops";
                s.Responses[StatusCodes.Status204NoContent] = "New order stored";
                s.Responses[StatusCodes.Status400BadRequest] =
                    "The run is no longer editable, or the list is not exactly its stops";
                s.Responses[StatusCodes.Status404NotFound] = "Shipment not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ReorderShipmentStopsRequest req, CancellationToken ct)
    {
        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, req.Id, ct);

        // Just the stops. Nothing else is read or written, which is the point of this endpoint.
        var shipment = await dbContext.OutgoingShipments
            .Include(os => os.Stops)
            .FirstOrDefaultAsync(os => os.PublicId == req.Id, ct);

        if (shipment is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);
            return;
        }

        if (!ShipmentMutability.IsContentEditable(shipment.State))
        {
            ThrowHelper.BadRequest($"Stops of a {shipment.State} shipment can no longer be reordered.");
            return;
        }

        var requested = req.Data.StopIds;

        if (requested.Distinct().Count() != requested.Count)
        {
            ThrowHelper.BadRequest("The same stop was listed more than once.");
            return;
        }

        var byPublicId = shipment.Stops.ToDictionary(s => s.PublicId);

        // Exactly the run's stops: a missing one would end up with no position at all, and an
        // unknown one means the client is working from a stale route — either way the sequence
        // it is asking for is not one this run can have.
        if (requested.Count != byPublicId.Count || requested.Any(id => !byPublicId.ContainsKey(id)))
        {
            ThrowHelper.BadRequest(
                $"Expected all {byPublicId.Count} stops of the shipment, got {requested.Count}.");
            return;
        }

        for (var i = 0; i < requested.Count; i++)
        {
            byPublicId[requested[i]].Order = i + 1;
        }

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
