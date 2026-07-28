using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.SetPreparationStep;

/// <summary>
/// Whether a preparation step has been done.
/// </summary>
public sealed record SetPreparationStepDto
{
    /// <summary>
    /// New value of the step's tick.
    /// </summary>
    public bool IsDone { get; set; }
}

/// <summary>
/// Request to tick or untick one preparation step of an outgoing shipment.
/// </summary>
public sealed record SetPreparationStepRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Public ID of the preparation step.
    /// </summary>
    public Guid StepId { get; set; }

    /// <summary>
    /// The new tick value.
    /// </summary>
    [FromBody]
    public SetPreparationStepDto Data { get; set; } = null!;
}

/// <summary>
/// Validator for <see cref="SetPreparationStepRequest"/>.
/// </summary>
public sealed class SetPreparationStepValidator : Validator<SetPreparationStepRequest>
{
    public SetPreparationStepValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.StepId).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
    }
}

/// <summary>
/// Endpoint ticking one step of a shipment's preparation checklist.
/// </summary>
/// <remarks>
/// Its own endpoint rather than a field on the full-object PUT, for the same reason
/// <see cref="Commands.SetLoadingState.SetLoadingStateEndpoint"/> is: the detail screen ticks one
/// box at a time and must not resend — and so risk rewriting — the whole shipment to do it.
///
/// Ticking follows the loading rule, not the content rule: it stays possible while the run is
/// Loaded and InTransit, and stops once the shipment is delivered or cancelled.
/// </remarks>
/// <param name="dbContext"></param>
public sealed class SetPreparationStepEndpoint(AleTrackDbContext dbContext) : Endpoint<SetPreparationStepRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("outgoing-shipments/{Id:guid}/preparation-steps/{StepId:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetPreparationStepEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Ticks or unticks one preparation step of an outgoing shipment";
                s.Responses[StatusCodes.Status204NoContent] = "Step stored";
                s.Responses[StatusCodes.Status400BadRequest] = "Shipment preparation can no longer be changed";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment or step not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetPreparationStepRequest req, CancellationToken ct)
    {
        var shipment = await dbContext.OutgoingShipments
            .Include(s => s.PreparationSteps)
            .FirstOrDefaultAsync(s => s.PublicId == req.Id, ct);

        if (shipment is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);
            return;
        }

        if (!PurchaseInvoiceSplit.IsEditable(shipment))
        {
            ThrowHelper.BadRequest($"Preparation of a {shipment.State} shipment can no longer be changed.");
            return;
        }

        // Looked up within the shipment's own collection, so a step ID belonging to another
        // shipment reads as not found rather than silently updating someone else's checklist.
        var step = shipment.PreparationSteps.FirstOrDefault(s => s.PublicId == req.StepId);
        if (step is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipmentPreparationStep), req.StepId);
            return;
        }

        step.IsDone = req.Data.IsDone;

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
