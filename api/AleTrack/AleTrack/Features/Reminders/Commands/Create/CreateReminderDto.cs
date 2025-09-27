using AleTrack.Common.Enums;

namespace AleTrack.Features.Reminders.Commands.Create;

/// <summary>
/// Data transfer object used to create a reminder.
/// This object contains the properties required to define a reminder, including its name,
/// type, occurrence details, recurrence settings, and associated brewery.
/// </summary>
public sealed record CreateReminderDto
{
    /// <summary>
    /// Name of the reminder
    /// </summary>
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Description of the reminder
    /// </summary>
    public string? Description { get; set; }
    
    /// <summary>
    /// Type of the reminder
    /// </summary>
    public ReminderType Type { get; set; }
    
    /// <summary>
    /// Date when the reminding action should happen. Mandatory for one-time event reminders, null for regular reminders
    /// </summary>
    public DateOnly? OccurrenceDate { get; set; }
    
    /// <summary>
    /// Number of days before the action date when the user should be reminded
    /// </summary>
    public int NumberOfDaysToRemindBefore { get; set; }
    
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
    
    /// <summary>
    /// Date until when the reminder is active. Mandatory for regular reminders, null for one-time event reminders
    /// </summary>
    public DateOnly? ActiveUntil { get; set; }
    
    /// <summary>
    /// PublicId of the brewery the reminder belongs to
    /// </summary>
    public Guid BreweryId { get; set; }
}