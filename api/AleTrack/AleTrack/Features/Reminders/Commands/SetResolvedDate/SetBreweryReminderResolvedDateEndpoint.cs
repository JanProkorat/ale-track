using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reminders.Commands.SetResolvedDate;

/// <summary>
/// Represents a request to set the resolved date of a brewery reminder.
/// </summary>
public record SetBreweryReminderResolvedDateRequest
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
/// Endpoint for handling requests to set the resolved date of a brewery reminder.
/// </summary>
public sealed class SetBreweryReminderResolvedDateEndpoint(AleTrackDbContext dbContext) : Endpoint<SetBreweryReminderResolvedDateRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Patch("breweries/reminders/{Id:guid}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetBreweryReminderResolvedDateEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Sets ResolvedDate of a brewery reminder";
                s.Responses[StatusCodes.Status202Accepted] = "Reminder updated";
                s.Responses[StatusCodes.Status404NotFound] = "Reminder not found";
            }
        );
    }

    public override async Task HandleAsync(SetBreweryReminderResolvedDateRequest req, CancellationToken ct)
    {
        var existingReminder = await dbContext.BreweryReminders
            .Include(r => r.Brewery)
            .FirstOrDefaultAsync(r => r.PublicId == req.Id, ct);
        
        if (existingReminder is null)
            ThrowHelper.PublicEntityNotFound(nameof(Reminder), req.Id);
        
        existingReminder!.ResolvedDate = req.ResolvedDate;
        dbContext.BreweryReminders.Update(existingReminder);
        await dbContext.SaveChangesAsync(ct);
        
        await Send.ResponseAsync(null, statusCode: StatusCodes.Status202Accepted ,cancellation: ct);
    }
}