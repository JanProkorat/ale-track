using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reminders.Commands.SetResolvedDate;

/// <summary>
/// Represents a request to set the resolved date of a reminder.
/// </summary>
public record SetReminderResolvedDateRequest
{
    /// <summary>
    /// ID of the reminder to set a resolved date for
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Date when the user resolved the reminder
    /// </summary>
    public DateOnly? ResolvedDate { get; set; }
}

/// <summary>
/// Endpoint for handling requests to set the resolved date of a reminder.
/// </summary>
public sealed class SetReminderResolvedDateEndpoint(AleTrackDbContext dbContext) : Endpoint<SetReminderResolvedDateRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Patch("reminders/{Id:guid}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetReminderResolvedDateEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Sets ResolvedDate of a reminder";
                s.Responses[StatusCodes.Status202Accepted] = "Reminder updated";
                s.Responses[StatusCodes.Status404NotFound] = "Reminder not found";
            }
        );
    }

    public override async Task HandleAsync(SetReminderResolvedDateRequest req, CancellationToken ct)
    {
        var existingReminder = await dbContext.Reminders
            .Include(r => r.Brewery)
            .FirstOrDefaultAsync(r => r.PublicId == req.Id, ct);
        
        if (existingReminder is null)
            ThrowHelper.PublicEntityNotFound(nameof(Reminder), req.Id);
        
        existingReminder!.ResolvedDate = req.ResolvedDate;
        dbContext.Reminders.Update(existingReminder);
        await dbContext.SaveChangesAsync(ct);
        
        await SendAsync(null, statusCode: StatusCodes.Status202Accepted ,cancellation: ct);
    }
}