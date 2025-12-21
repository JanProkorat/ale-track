namespace AleTrack.Features.Reminders.Queries.UpcomingList;

public sealed record ReminderSectionDto
{
    /// <summary>
    /// ID of the related parent - brewery or a client.
    /// </summary>
    public Guid SectionId { get; set; }

    /// <summary>
    /// Name of the parent associated with the reminder
    /// </summary>
    public string SectionName { get; set; } = null!;

    /// <summary>
    /// Represents the type of the section associated with the reminder.
    /// </summary>
    public SectionType SectionType { get; set; }
    
    /// <summary>
    /// List of upcoming reminders for the brewery.
    /// </summary>
    public List<UpcomingReminderDto> Reminders { get; set; } = [];
}

public record UpcomingReminderDto
{
    /// <summary>
    /// ID of the reminder
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
    /// Date when the reminding action should happen
    /// </summary>
    public DateOnly OccurrenceDate { get; set; }
}