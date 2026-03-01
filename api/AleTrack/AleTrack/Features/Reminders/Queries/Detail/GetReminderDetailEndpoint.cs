using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reminders.Queries.Detail;

/// <summary>
/// Represents the request model for retrieving the detailed information of a specific reminder.
/// </summary>
public record GetReminderDetailRequest
{
    /// <summary>
    /// ID of the reminder to retrieve details for
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Represents the endpoint responsible for retrieving detailed information about a specific reminder.
/// Uses the provided database context to query and return the reminder's details.
/// Handles scenarios such as not-found responses and ensures proper role-based access.
/// </summary>
public sealed class GetReminderDetailEndpoint(AleTrackDbContext dbContext) : Endpoint<GetReminderDetailRequest, ReminderDetailDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("reminders/{id}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(GetReminderDetailEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets reminder detail";
            s.Responses[StatusCodes.Status200OK] = "Detail of reminder";
            s.SetNotFoundResponse("reminder");
        });
    }
    
    public override async Task HandleAsync(GetReminderDetailRequest req, CancellationToken ct)
    {
        var breweryRemindersQuery = dbContext.BreweryReminders
            .Where(r => r.PublicId == req.Id);
        
        var clientRemindersQuery = dbContext.ClientReminders
            .Where(r => r.PublicId == req.Id);
        
        var reminder = await GetBreweryReminderDetail(breweryRemindersQuery, ct);
        if (reminder is null)
            reminder = await GetClientReminderDetail(clientRemindersQuery, ct);
            
        if (reminder is null)
            ThrowHelper.PublicEntityNotFound(nameof(Reminder), req.Id);
        
        await Send.ResponseAsync(reminder!, cancellation: ct);
    }

    private static async Task<ReminderDetailDto?> GetBreweryReminderDetail(IQueryable<BreweryReminder> breweryRemindersQuery, CancellationToken cancellationToken)
    {
        var reminder = await breweryRemindersQuery
            .Select(r => new ReminderDetailDto
            {
                Id = r.PublicId,
                Name = r.Name,
                Description = r.Description,
                Type = r.Type,
                NumberOfDaysToRemindBefore = r.NumberOfDaysToRemindBefore,
                ActiveUntil = r.ActiveUntil,
                DaysOfMonth = r.DaysOfMonth,
                DaysOfWeek = r.DaysOfWeek,
                OccurrenceDate = r.OccurrenceDate,
                RecurrenceType = r.RecurrenceType,
                ResolvedDate = r.ResolvedDate
            })
            .FirstOrDefaultAsync(cancellationToken);
        
        return reminder;
    }
    
    private static async Task<ReminderDetailDto?> GetClientReminderDetail(IQueryable<ClientReminder> clientRemindersQuery, CancellationToken cancellationToken)
    {
        var reminder = await clientRemindersQuery
            .Select(r => new ReminderDetailDto
            {
                Id = r.PublicId,
                Name = r.Name,
                Description = r.Description,
                Type = r.Type,
                NumberOfDaysToRemindBefore = r.NumberOfDaysToRemindBefore,
                ActiveUntil = r.ActiveUntil,
                DaysOfMonth = r.DaysOfMonth,
                DaysOfWeek = r.DaysOfWeek,
                OccurrenceDate = r.OccurrenceDate,
                RecurrenceType = r.RecurrenceType,
                ResolvedDate = r.ResolvedDate
            })
            .FirstOrDefaultAsync(cancellationToken);
        
        return reminder;
    }
}