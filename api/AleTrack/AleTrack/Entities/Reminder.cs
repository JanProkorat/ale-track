using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Entity representing a reminder
/// </summary>
public class Reminder: PublicEntity
{
    /// <summary>
    /// Name of the reminder
    /// </summary>
    [Required]
    [MaxLength(100)]
    [Column("name")]
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Description of the reminder
    /// </summary>
    [MaxLength(1000)]
    [Column("description")]
    public string? Description { get; set; }
    
    /// <summary>
    /// Type of the reminder
    /// </summary>
    [Column("type")]
    public ReminderType Type { get; set; }
    
    /// <summary>
    /// Date when the reminding action should happen. Mandatory for one-time event reminders, null for regular reminders
    /// In case of order items, reminders are also possibly null
    /// </summary>
    [Column("occurrence_date")]
    public DateOnly? OccurrenceDate { get; set; }
    
    /// <summary>
    /// Number of days before the action date when the user should be reminded
    /// </summary>
    [Column("number_of_days_to_remind_before")]
    public int NumberOfDaysToRemindBefore { get; set; }
    
    /// <summary>
    /// Recurrence type of the reminder. Mandatory for regular reminders, null for one-time event reminders
    /// </summary>
    [Column("recurrence_type")]
    public ReminderRecurrenceType? RecurrenceType { get; set; }

    /// <summary>
    /// Days of the week when the reminder should occur Mandatory for regular reminders ff RecurrenceType = Weekly
    /// </summary>
    [Column("days_of_week")]
    public List<DayOfWeek>? DaysOfWeek { get; set; }

    /// <summary>
    /// Concrete days in month (1–31) when the reminder should occur. Mandatory for regular reminders if RecurrenceType = Monthly
    /// </summary>
    [Column("days_of_month")]
    public List<int>? DaysOfMonth { get; set; }
    
    /// <summary>
    /// Date until when the reminder is active. Mandatory for regular reminders, null for one-time event reminders
    /// </summary>
    [Column("active_until")]
    public DateOnly? ActiveUntil { get; set; }
    
    /// <summary>
    /// Date when the user set the reminder as resolved
    /// </summary>
    [Column("resolved_date")]
    public DateOnly? ResolvedDate { get; set; }
}