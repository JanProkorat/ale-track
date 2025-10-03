using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Entity representing a client
/// </summary>
[Table("clients")]
public sealed class Client : PublicSoftlyDeletableEntity
{
    /// <summary>
    /// Name of the client
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("name")]
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Name of the client's business
    /// </summary>
    [MaxLength(50)]
    [Column("business_name")]
    public string? BusinessName { get; set; }
    
    /// <summary>
    /// Region of the client
    /// </summary>
    [Column("region")]
    public Region Region { get; set; }
    
    /// <summary>
    /// Official address of the client
    /// </summary>
    public Address OfficialAddress { get; set; } = null!;

    /// <summary>
    /// Contact address of the client, which can be null
    /// </summary>
    public Address? ContactAddress { get; set; }
    
    /// <summary>
    /// List of orders from this client
    /// </summary>
    public ICollection<Order> Orders { get; set; } = [];
    
    /// <summary>
    /// Related contacts of the client
    /// </summary>
    public List<ClientContact> Contacts { get; set; } = [];

    /// <summary>
    /// Collection of notes associated with the client
    /// </summary>
    public List<ClientNote> Notes { get; set; } = [];
    
    /// <summary>
    /// Related reminders
    /// </summary>
    public List<ClientReminder> Reminders { get; set; } = [];
}