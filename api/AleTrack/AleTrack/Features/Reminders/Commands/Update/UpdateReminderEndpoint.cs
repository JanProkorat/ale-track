using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reminders.Commands.Update;

/// <summary>
/// Request to update a new reminder
/// </summary>
public record UpdateReminderRequest
{
    /// <summary>
    /// ID of the reminder to update
    /// </summary>
    public Guid Id { get; set; }

    [FromBody] public UpdateReminderDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint to update a new reminder
/// </summary>
public sealed class UpdateReminderEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateReminderRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("reminders/{Id:guid}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(UpdateReminderEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates a reminder";
                s.Responses[StatusCodes.Status204NoContent] = "Reminder updated";
                s.Responses[StatusCodes.Status404NotFound] = "Reminder or Brewery not found";
            }
        );
    }

    public override async Task HandleAsync(UpdateReminderRequest req, CancellationToken ct)
    {
        var existingReminder = await dbContext.Reminders
            .Include(r => r.Brewery)
            .FirstOrDefaultAsync(r => r.PublicId == req.Id, ct);

        if (existingReminder is null)
            ThrowHelper.PublicEntityNotFound(nameof(Reminder), req.Id);

        existingReminder!.Name = req.Data.Name;
        existingReminder.Description = req.Data.Description;
        existingReminder.Type = req.Data.Type;
        existingReminder.NumberOfDaysToRemindBefore = req.Data.NumberOfDaysToRemindBefore;
        existingReminder.ResolvedDate = req.Data.ResolvedDate;

        switch (req.Data.Type)
        {
            case ReminderType.OneTimeEvent:
                existingReminder.OccurrenceDate = req.Data.OccurrenceDate;
                break;
            case ReminderType.Regular:
            {
                existingReminder.ActiveUntil = req.Data.ActiveUntil;

                existingReminder.RecurrenceType = req.Data.RecurrenceType;
                if (req.Data.RecurrenceType is ReminderRecurrenceType.Weekly)
                    existingReminder.DaysOfWeek = (req.Data.DaysOfWeek ?? [])
                        .OrderBy(d => ((int)d + 6) % 7) // Move Sunday (0) to the end
                        .ToList();
                else
                    existingReminder.DaysOfMonth = (req.Data.DaysOfMonth ?? [])
                        .OrderBy(d => d)
                        .ToList();
                break;
            }
        }

        dbContext.Reminders.Update(existingReminder);
        await dbContext.SaveChangesAsync(ct);

        await SendNoContentAsync(ct);
    }
}