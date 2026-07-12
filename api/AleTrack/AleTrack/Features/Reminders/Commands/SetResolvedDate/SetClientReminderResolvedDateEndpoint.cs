using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reminders.Commands.SetResolvedDate;

/// <summary>
/// Represents a request to set the resolved date of a client reminder.
/// </summary>
public record SetClientReminderResolvedDateRequest
{
    /// <summary>
    /// ID of the client reminder to set a resolved date for
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Date when the user resolved the reminder
    /// </summary>
    public DateOnly? ResolvedDate { get; set; }
}

/// <summary>
/// Endpoint for handling requests to set the resolved date of a client reminder.
/// </summary>
public sealed class SetClientReminderResolvedDateEndpoint(AleTrackDbContext dbContext) : Endpoint<SetClientReminderResolvedDateRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Patch("clients/reminders/{Id:guid}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetClientReminderResolvedDateEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Sets ResolvedDate of a client reminder";
                s.Responses[StatusCodes.Status202Accepted] = "Reminder updated";
                s.Responses[StatusCodes.Status404NotFound] = "Reminder not found";
            }
        );
    }

    public override async Task HandleAsync(SetClientReminderResolvedDateRequest req, CancellationToken ct)
    {
        var existingReminder = await dbContext.ClientReminders
            .Include(r => r.Client)
            .FirstOrDefaultAsync(r => r.PublicId == req.Id, ct);
        
        if (existingReminder is null)
            ThrowHelper.PublicEntityNotFound(nameof(ClientReminder), req.Id);
        
        existingReminder!.ResolvedDate = req.ResolvedDate;
        dbContext.ClientReminders.Update(existingReminder);
        await dbContext.SaveChangesAsync(ct);
        
        await Send.ResponseAsync(null, statusCode: StatusCodes.Status202Accepted ,cancellation: ct);
    }
}