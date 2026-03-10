using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reminders.Queries.UpcomingList;

public sealed class GetUpcomingRemindersEndpoint(AleTrackDbContext dbContext) : EndpointWithoutRequest<List<ReminderSectionDto>>
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
            s.Summary = "Gets all upcoming reminders for all breweries and clients";
            s.Responses[StatusCodes.Status200OK] = "List of reminders";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var today = DateTime.UtcNow;
        var todayDate = DateOnly.FromDateTime(today);

        var breweryReminders = await GetBreweryReminders(todayDate, ct);
        var clientReminders = await GetClientReminders(todayDate, ct);
        
        var allCandidates = breweryReminders.Concat(clientReminders);

        var data = ProcessReminders(allCandidates, today);

        await Send.OkAsync(data, cancellation: ct);
    }

    private async Task<List<(OrderItem orderItem, string sectionName, Guid sectionId, SectionType sectionType)>> GetOrderItemReminders(DateOnly todayDate, CancellationToken ct)
    {
        var candidates = await dbContext.OrderItems
            .Where(o => (o.Order.RequiredDeliveryDate == null || o.Order.RequiredDeliveryDate > todayDate) && o.ReminderState == OrderItemReminderState.Added)
            .Include(i => i.Product)
                .ThenInclude(p => p.Brewery)
            .Include(i => i.Order)
            .ToListAsync(ct);
        
        return candidates
            .Select(i => (
                orderItem: i,
                sectionName: i.Product.Brewery.Name,
                sectionId: i.Order.PublicId,
                sectionType: SectionType.OrderItem
            ))
            .ToList();
    }
    
    private async Task<List<(Reminder reminder, string sectionName, Guid sectionId, SectionType sectionType)>> GetBreweryReminders(DateOnly todayDate, CancellationToken ct)
    {
        var candidates = await dbContext.BreweryReminders
            .Where(r => !r.ResolvedDate.HasValue
                        && ((r.Type == ReminderType.OneTimeEvent
                             && r.OccurrenceDate!.Value.AddDays(-r.NumberOfDaysToRemindBefore) <= todayDate
                             && r.OccurrenceDate!.Value >= todayDate) ||
                            (r.Type == ReminderType.Regular
                             && r.ActiveUntil!.Value >= todayDate)))
            .Include(r => r.Brewery)
            .ToListAsync(ct);

        return candidates
            .Select(r => (
                reminder: (Reminder)r,
                sectionName: r.Brewery.Name,
                sectionId: r.Brewery.PublicId,
                sectionType: SectionType.Brewery
            ))
            .ToList();
    }

    private async Task<List<(Reminder reminder, string sectionName, Guid sectionId, SectionType sectionType)>> GetClientReminders(DateOnly todayDate, CancellationToken ct)
    {
        var candidates = await dbContext.ClientReminders
            .Where(r => !r.ResolvedDate.HasValue
                        && ((r.Type == ReminderType.OneTimeEvent
                             && r.OccurrenceDate!.Value.AddDays(-r.NumberOfDaysToRemindBefore) <= todayDate
                             && r.OccurrenceDate!.Value >= todayDate) ||
                            (r.Type == ReminderType.Regular
                             && r.ActiveUntil!.Value >= todayDate)))
            .Include(r => r.Client)
            .ToListAsync(ct);

        return candidates
            .Select(r => (
                reminder: (Reminder)r,
                sectionName: r.Client.Name,
                sectionId: r.Client.PublicId,
                sectionType: SectionType.Client
            ))
            .ToList();
    }

    private static List<ReminderSectionDto> ProcessReminders(
        IEnumerable<(Reminder reminder, string sectionName, Guid sectionId, SectionType sectionType)> candidates,
        DateTime today)
    {
        return candidates
            .Where(item => item.reminder.Type == ReminderType.OneTimeEvent ||
                          (item.reminder.Type == ReminderType.Regular &&
                           ((item.reminder.RecurrenceType == ReminderRecurrenceType.Weekly
                             && item.reminder.DaysOfWeek!.Any(dayOfWeek =>
                                 GetDaysUntilDayOfWeek(today.DayOfWeek, dayOfWeek) <= item.reminder.NumberOfDaysToRemindBefore)) ||
                            (item.reminder.RecurrenceType == ReminderRecurrenceType.Monthly
                             && item.reminder.DaysOfMonth!.Any(dayOfMonth =>
                                 GetDaysUntilDayOfMonth(today.Day, dayOfMonth, today.Month, today.Year) <= item.reminder.NumberOfDaysToRemindBefore)))))
            .GroupBy(item => new { item.sectionName, item.sectionId, item.sectionType })
            .Select(g => new ReminderSectionDto
            {
                SectionId = g.Key.sectionId,
                SectionName = g.Key.sectionName,
                SectionType = g.Key.sectionType,
                Reminders = g
                    .Select(item => new UpcomingReminderDto
                    {
                        Id = item.reminder.PublicId,
                        Name = item.reminder.Name,
                        Description = item.reminder.Description,
                        OccurrenceDate = item.reminder.Type == ReminderType.OneTimeEvent
                            ? item.reminder.OccurrenceDate!.Value
                            : GetNextOccurrenceDate(item.reminder, today)
                    })
                    .ToList()
            })
            .ToList();
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