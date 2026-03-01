using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reminders.Commands.Update.Brewery;

/// <summary>
/// Request to update a brewery reminder
/// </summary>
public record UpdateBreweryReminderRequest
{
    /// <summary>
    /// ID of the reminder to update
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody] 
    public UpdateReminderDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint to update a brewery reminder
/// </summary>
public sealed class UpdateBreweryReminderEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateBreweryReminderRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("breweries/reminders/{Id:guid}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(UpdateBreweryReminderEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates a brewery reminder";
                s.Responses[StatusCodes.Status204NoContent] = "Reminder updated";
                s.Responses[StatusCodes.Status404NotFound] = "Reminder or Brewery not found";
            }
        );
    }

    public override async Task HandleAsync(UpdateBreweryReminderRequest req, CancellationToken ct)
    {
        var existingReminder = await dbContext.BreweryReminders.FirstOrDefaultAsync(r => r.PublicId == req.Id, ct);
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

        dbContext.BreweryReminders.Update(existingReminder);
        await dbContext.SaveChangesAsync(ct);

        await SendNoContentAsync(ct);
    }
}