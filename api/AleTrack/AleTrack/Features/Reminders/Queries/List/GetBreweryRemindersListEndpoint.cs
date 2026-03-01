using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reminders.Queries.List;

/// <summary>
/// Represents a request to retrieve a list of reminders for a specific brewery.
/// </summary>
public record GetBreweryRemindersListRequest : FilterableRequest
{
    /// <summary>
    /// ID of the brewery to get reminders for
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Represents an API endpoint for retrieving a filtered list of reminders associated with a specific brewery.
/// </summary>
public sealed class GetBreweryRemindersListEndpoint(AleTrackDbContext dbContext) : Endpoint<GetBreweryRemindersListRequest, List<ReminderListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("breweries/{id:guid}/reminders");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetBreweryRemindersListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered reminders list for a brewery";
            s.Responses[StatusCodes.Status200OK] = "List of reminders";
        });
    }

    public override async Task HandleAsync(GetBreweryRemindersListRequest req, CancellationToken ct)
    {
        var brewery = await dbContext.BreweryReminders
            .Where(r => r.Brewery.PublicId == req.Id)
            .Select(r => new ReminderListItemDto
            {
                Id = r.PublicId,
                Name = r.Name,
                Description = r.Description,
                OccurrenceDate = r.OccurrenceDate,
                IsResolved = r.ResolvedDate.HasValue || (r.ActiveUntil.HasValue && r.ActiveUntil < DateOnly.FromDateTime(DateTime.UtcNow)),
                Type = r.Type,
                DaysOfMonth = r.DaysOfMonth,
                DaysOfWeek = r.DaysOfWeek,
                RecurrenceType = r.RecurrenceType,
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);
        
        await Send.ResponseAsync(brewery, cancellation: ct);
    }
}