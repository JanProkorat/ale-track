using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reminders.Queries.UpcomingList;

public sealed class GetUpcomingRemindersEndpoint(AleTrackDbContext dbContext) : EndpointWithoutRequest<List<ReminderBreweryDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("reminders");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetUpcomingRemindersEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets all upcoming reminders for all breweries";
            s.Responses[StatusCodes.Status200OK] = "List of reminders";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var today = DateTime.UtcNow;
        var todayDate = DateOnly.FromDateTime(today);

        var candidates = await dbContext.Reminders
            .Where(r => !r.ResolvedDate.HasValue
                        && ((r.Type == ReminderType.OneTimeEvent
                             && r.OccurrenceDate!.Value.AddDays(-r.NumberOfDaysToRemindBefore) <= todayDate
                             && r.OccurrenceDate!.Value >= todayDate) ||
                            (r.Type == ReminderType.Regular
                             && r.ActiveUntil!.Value >= todayDate)))
            .Include(r => r.Brewery)
            .ToListAsync(ct);

        var data = candidates
            .Where(r => r.Type == ReminderType.OneTimeEvent || // OneTime events are already filtered out
                        (r.Type == ReminderType.Regular && 
                         ((r.RecurrenceType == ReminderRecurrenceType.Weekly
                           && r.DaysOfWeek!.Any(dayOfWeek => 
                               GetDaysUntilDayOfWeek(today.DayOfWeek, dayOfWeek) <= r.NumberOfDaysToRemindBefore)) ||
                          (r.RecurrenceType == ReminderRecurrenceType.Monthly
                           && r.DaysOfMonth!.Any(dayOfMonth => 
                               GetDaysUntilDayOfMonth(today.Day, dayOfMonth, today.Month, today.Year) <= r.NumberOfDaysToRemindBefore)))))
            .GroupBy(r => new { r.Brewery.Name, r.Brewery.PublicId })
            .Select(g => new ReminderBreweryDto
            {
                BreweryId = g.Key.PublicId,
                BreweryName = g.Key.Name,
                Reminders = g
                    .Select(r => new UpcomingReminderDto
                    {
                        Id = r.PublicId,
                        Name = r.Name,
                        Description = r.Description,
                        OccurrenceDate = r.Type == ReminderType.OneTimeEvent 
                            ? r.OccurrenceDate!.Value 
                            : GetNextOccurrenceDate(r, today)
                    })
                    .ToList()
            })
            .ToList();
        
        await SendAsync(data, cancellation: ct);
    }
    
    private static DateOnly GetNextOccurrenceDate(Reminder reminder, DateTime today)
    {
        return reminder.RecurrenceType switch
        {
            ReminderRecurrenceType.Weekly => GetNextWeeklyOccurrence(reminder.DaysOfWeek!, today),
            ReminderRecurrenceType.Monthly => GetNextMonthlyOccurrence(reminder.DaysOfMonth!, today),
            _ => DateOnly.FromDateTime(today) // fallback
        };
    }
    
    private static DateOnly GetNextWeeklyOccurrence(List<DayOfWeek> daysOfWeek, DateTime today)
    {
        var sortedDays = daysOfWeek
            .Select(day => new
            {
                Day = day, 
                DaysUntil = GetDaysUntilDayOfWeek(today.DayOfWeek, day)
            })
            .OrderBy(x => x.DaysUntil)
            .ToList();
        
        // Find the closest day (Today is included if it is in the list)
        var nextDay = sortedDays[0];
        return DateOnly.FromDateTime(today.AddDays(nextDay.DaysUntil));
    }
    
    private static DateOnly GetNextMonthlyOccurrence(List<int> daysOfMonth, DateTime today)
    {
        var currentMonth = today.Month;
        var currentYear = today.Year;
        
        // First, find it in the current month
        var daysInCurrentMonth = DateTime.DaysInMonth(currentYear, currentMonth);
        var availableDaysThisMonth = daysOfMonth
            .Where(day => day <= daysInCurrentMonth && day >= today.Day)
            .OrderBy(day => day)
            .ToList();
            
        if (availableDaysThisMonth.Count > 0)
        {
            var nextDay = availableDaysThisMonth[0];
            return new DateOnly(currentYear, currentMonth, nextDay);
        }
        
        // If it is not in the current month, find it in the next month
        var nextMonth = currentMonth == 12 ? 1 : currentMonth + 1;
        var nextYear = currentMonth == 12 ? currentYear + 1 : currentYear;
        var daysInNextMonth = DateTime.DaysInMonth(nextYear, nextMonth);
        
        var availableDaysNextMonth = daysOfMonth
            .Where(day => day <= daysInNextMonth)
            .OrderBy(day => day)
            .ToList();

        if (availableDaysNextMonth.Count <= 0)
            // Fallback - if no date is available, return today's date'
            return DateOnly.FromDateTime(today);
        
        return new DateOnly(nextYear, nextMonth, availableDaysNextMonth[0]);
    }
    
    private static int GetDaysUntilDayOfWeek(DayOfWeek currentDayOfWeek, DayOfWeek targetDayOfWeek)
    {
        var daysUntil = ((int)targetDayOfWeek - (int)currentDayOfWeek + 7) % 7;
        return daysUntil == 0 ? 0 : daysUntil;
    }

    private static int GetDaysUntilDayOfMonth(int currentDay, int targetDay, int currentMonth, int currentYear)
    {
        if (targetDay >= currentDay)
            return targetDay - currentDay;
        
        var daysInCurrentMonth = DateTime.DaysInMonth(currentYear, currentMonth);
        return daysInCurrentMonth - currentDay + targetDay;
    }
}