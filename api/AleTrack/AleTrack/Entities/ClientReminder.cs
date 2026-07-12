using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a reminder associated with a specific client.
/// </summary>
[Table("client_reminders")]
public sealed class ClientReminder : Reminder
{
    /// <summary>
    /// ID of the client the reminder belongs to
    /// </summary>
    [Column("client_id")]
    public long ClientId { get; set; }
    
    /// <summary>
    /// Refers to the client the reminder belongs to
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Client Client { get; set; } = null!;
}