using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.SetStopCompletion;

/// <summary>
/// Whether the run has finished with a stop.
/// </summary>
public sealed record SetStopCompletionDto
{
    /// <summary>
    /// True to mark the stop finished, false to take the mark back.
    /// </summary>
    public bool IsCompleted { get; set; }
}

/// <summary>
/// Request to mark one stop of an outgoing shipment as finished, or to un-mark it.
/// </summary>
public sealed record SetStopCompletionRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Public ID of the stop.
    /// </summary>
    public Guid StopId { get; set; }

    /// <summary>
    /// The new mark.
    /// </summary>
    [FromBody]
    public SetStopCompletionDto Data { get; set; } = null!;
}

/// <summary>
/// Validator for <see cref="SetStopCompletionRequest"/>.
/// </summary>
public sealed class SetStopCompletionValidator : Validator<SetStopCompletionRequest>
{
    public SetStopCompletionValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.StopId).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
    }
}

/// <summary>
/// Endpoint marking one stop of a run as finished — unloaded and left behind.
/// </summary>
/// <remarks>
/// Nobody tracks the van: the drivers ring in as they go, and this is where what they said is
/// written down. Only while the run is InTransit, in both directions — before departure there is
/// nothing to have finished, and once the run is delivered its stops are a record rather than a
/// progress note. A revert to Loaded clears every mark (see
/// <see cref="Utils.ShipmentStateTransition"/>), so a second attempt at the round starts clean.
///
/// Its own narrow endpoint for the reason
/// <see cref="Commands.SetPreparationStep.SetPreparationStepEndpoint"/> gives: the screen ticks
/// one thing and must not resend the whole shipment to do it.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="driverScope"></param>
public sealed class SetStopCompletionEndpoint(AleTrackDbContext dbContext, IDriverScope driverScope)
    : Endpoint<SetStopCompletionRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}/stops/{StopId:guid}/completion");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetStopCompletionEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Marks one stop of an outgoing shipment as finished";
                s.Responses[StatusCodes.Status204NoContent] = "Mark stored";
                s.Responses[StatusCodes.Status400BadRequest] = "The run is not on the road";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment or stop not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetStopCompletionRequest req, CancellationToken ct)
    {
        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, req.Id, ct);

        var shipment = await dbContext.OutgoingShipments
            .Include(s => s.Stops)
            .FirstOrDefaultAsync(s => s.PublicId == req.Id, ct);

        if (shipment is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);
            return;
        }

        if (shipment.State != OutgoingShipmentState.InTransit)
        {
            ThrowHelper.BadRequest(
                $"Stops of a {shipment.State} shipment cannot be marked finished — only a run in transit.");
            return;
        }

        // Looked up within the shipment's own stops, so an id belonging to another run reads as
        // not found rather than silently marking someone else's route.
        var stop = shipment.Stops.FirstOrDefault(s => s.PublicId == req.StopId);
        if (stop is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipmentStop), req.StopId);
            return;
        }

        // Re-marking keeps the first time: it is when the van actually left, and a second tick on
        // an already-finished stop is a stray click rather than a correction.
        if (req.Data.IsCompleted)
        {
            stop.CompletedAt ??= DateTime.UtcNow;
        }
        else
        {
            stop.CompletedAt = null;
        }

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
