using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reminders.Commands.Create;

/// <summary>
/// Request to create a new reminder
/// </summary>
public record CreateReminderRequest
{
    [FromBody]
    public CreateReminderDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint to create a new reminder
/// </summary>
public sealed class CreateReminderEndpoint(AleTrackDbContext dbContext) : Endpoint<CreateReminderRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("reminders");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status201Created)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(CreateReminderEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates a reminder";
                s.Responses[StatusCodes.Status201Created] = "Reminder created";
                s.Responses[StatusCodes.Status404NotFound] = "Brewery not found";
            }
        );
    }

    public override async Task HandleAsync(CreateReminderRequest req, CancellationToken ct)
    {
        var brewery = await dbContext.Breweries.FirstOrDefaultAsync(b => b.PublicId == req.Data.BreweryId, ct);
        if (brewery is null)
            ThrowHelper.PublicEntityNotFound(nameof(Brewery), req.Data.BreweryId);

        var reminder = new Reminder
        {
            Brewery = brewery!,
            Name = req.Data.Name,
            Description = req.Data.Description,
            Type = req.Data.Type,
            NumberOfDaysToRemindBefore = req.Data.NumberOfDaysToRemindBefore,
        };

        switch (req.Data.Type)
        {
            case ReminderType.OneTimeEvent:
                reminder.OccurrenceDate = req.Data.OccurrenceDate;
                break;
            case ReminderType.Regular:
            {
                reminder.ActiveUntil = req.Data.ActiveUntil;
            
                reminder.RecurrenceType = req.Data.RecurrenceType;
                if (req.Data.RecurrenceType is ReminderRecurrenceType.Weekly)
                    reminder.DaysOfWeek = (req.Data.DaysOfWeek ?? [])
                        .OrderBy(d => ((int)d + 6) % 7) // Move Sunday (0) to the end
                        .ToList();
                else
                    reminder.DaysOfMonth = (req.Data.DaysOfMonth ?? [])
                        .OrderBy(d => d)
                        .ToList();
                break;
            }
        }

        dbContext.Reminders.Add(reminder);
        await dbContext.SaveChangesAsync(ct);
        
        await SendAsync(reminder.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}