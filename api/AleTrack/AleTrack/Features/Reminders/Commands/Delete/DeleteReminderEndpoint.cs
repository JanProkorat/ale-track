using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reminders.Commands.Delete;

/// <summary>
/// Request to delete a new reminder
/// </summary>
public record DeleteReminderRequest
{
    /// <summary>
    /// ID of the reminder to delete
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to delete a new reminder
/// </summary>
public sealed class DeleteReminderEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteReminderRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("reminders/{Id:guid}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteReminderEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes a reminder";
                s.Responses[StatusCodes.Status202Accepted] = "Reminder deleted";
                s.Responses[StatusCodes.Status404NotFound] = "Reminder not found";
            }
        );
    }

    public override async Task HandleAsync(DeleteReminderRequest req, CancellationToken ct)
    {
        var existingReminder = await dbContext.Reminders.FirstOrDefaultAsync(r => r.PublicId == req.Id, ct);
        
        if (existingReminder is null)
            ThrowHelper.PublicEntityNotFound(nameof(Reminder), req.Id);

        dbContext.Reminders.Remove(existingReminder!);
        await dbContext.SaveChangesAsync(ct);

        await SendAsync(null, statusCode: StatusCodes.Status202Accepted, cancellation: ct);
    }
}