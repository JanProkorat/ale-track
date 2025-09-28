using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a reminder associated with a specific brewery.
/// </summary>
[Table("brewery_reminders")]
public sealed class BreweryReminder : Reminder
{
    /// <summary>
    /// Id of the brewery the reminder belongs to
    /// </summary>
    [Column("brewery_id")]
    public long BreweryId { get; set; }
    
    /// <summary>
    /// Refers to the brewery the reminder belongs to
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Brewery Brewery { get; set; } = null!;
}