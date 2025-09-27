namespace AleTrack.Features.Reminders.Queries.UpcomingList;

public sealed record ReminderBreweryDto
{
    /// <summary>
    /// ID of the related brewery.
    /// </summary>
    public Guid BreweryId { get; set; }

    /// <summary>
    /// Name of the brewery associated with the reminder
    /// </summary>
    public string BreweryName { get; set; } = null!;

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