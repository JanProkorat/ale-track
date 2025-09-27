using AleTrack.Common.Enums;

namespace AleTrack.Features.Reminders.Queries.Detail;

/// <summary>
/// Represents the details of a reminder, including metadata, schedule, and recurrence information.
/// </summary>
public sealed record ReminderDetailDto
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
    /// Date when the user set the reminder as resolved
    /// </summary>
    public DateOnly? ResolvedDate { get; set; }}