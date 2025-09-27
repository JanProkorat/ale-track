using AleTrack.Common.Enums;

namespace AleTrack.Features.Reminders.Queries.List;

/// <summary>
/// Represents a data transfer object (DTO) that encapsulates information about reminders associated with a brewery.
/// </summary>
public sealed record BreweryReminderDto
{
    /// <summary>
    /// Public ID of the reminder
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Name of the reminder
    /// </summary>
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Description of the reminder
    /// </summary>
    public string? Description { get; set; }
    
    /// <summary>
    /// Date when the reminding action should happen. Mandatory for one-time event reminders, null for regular reminders
    /// </summary>
    public DateOnly? OccurrenceDate { get; set; }
    
    /// <summary>
    /// Flag if reminder is resolved
    /// </summary>
    public bool IsResolved { get; set; }
    
    /// <summary>
    /// Type of the reminder
    /// </summary>
    public ReminderType Type { get; set; }
    
    /// <summary>
    /// Recurrence type of the reminder. Mandatory for regular reminders, null for one-time event reminders
    /// </summary>
    public ReminderRecurrenceType? RecurrenceType { get; set; }

    /// <summary>
    /// Days of the week when the reminder should occur Mandatory for regular reminders ff RecurrenceType = Weekly
    /// </summary>
    public List<DayOfWeek>? DaysOfWeek { get; set; }

    /// <summary>
    /// Concrete days in month (1–31) when the reminder should occur. Mandatory for regular reminders if RecurrenceType = Monthly
    /// </summary>
    public List<int>? DaysOfMonth { get; set; }
}