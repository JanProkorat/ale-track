using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reminders.Commands.Delete;

/// <summary>
/// Request to delete a brewery reminder
/// </summary>
public record DeleteBreweryReminderRequest
{
    /// <summary>
    /// ID of the reminder to delete
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to delete a brewery reminder
/// </summary>
public sealed class DeleteBreweryReminderEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteBreweryReminderRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("breweries/reminders/{Id:guid}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteBreweryReminderEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes a brewery reminder";
                s.Responses[StatusCodes.Status202Accepted] = "Reminder deleted";
                s.Responses[StatusCodes.Status404NotFound] = "Reminder not found";
            }
        );
    }

    public override async Task HandleAsync(DeleteBreweryReminderRequest req, CancellationToken ct)
    {
        var existingReminder = await dbContext.BreweryReminders.FirstOrDefaultAsync(r => r.PublicId == req.Id, ct);
        
        if (existingReminder is null)
            ThrowHelper.PublicEntityNotFound(nameof(BreweryReminder), req.Id);

        dbContext.BreweryReminders.Remove(existingReminder!);
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(null, statusCode: StatusCodes.Status202Accepted, cancellation: ct);
    }
}