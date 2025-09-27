using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reminders.Queries.Detail;

public record GetReminderDetailRequest
{
    /// <summary>
    /// ID of the reminder to retrieve details for
    /// </summary>
    public Guid Id { get; set; }
}

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
        var reminder = await dbContext.Reminders
            .Where(r => r.PublicId == req.Id)
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
            .FirstOrDefaultAsync(ct);

        if (reminder is null)
            ThrowHelper.PublicEntityNotFound(nameof(Reminder), req.Id);
        
        await SendAsync(reminder!, cancellation: ct);
    }
}