using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a contact record containing information about the type of contact
/// and its corresponding value.
/// </summary>
[Table("client_contacts")]
public class ClientContact : BaseEntity
{
    /// <summary>
    /// ID of related <see cref="Client"/>
    /// </summary>
    [Column("client_id")]
    public long ClientId { get; set; }
    
    /// <summary>
    /// Gets or sets the type of contact, which indicates the category or nature
    /// of the contact such as Email or Phone.
    /// </summary>
    [Column("type")]
    public ContactType Type { get; set; }

    /// <summary>
    /// Description of the contact, such as "Work" or "Home"
    /// </summary>
    [MaxLength(50)]
    [Column("description")]
    public string? Description { get; set; }
    
    /// <summary>
    /// Gets or sets the value associated with the contact, such as an email address
    /// or phone number, depending on the contact type.
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("value")]
    public string Value { get; set; } = null!;
    
    /// <summary>
    /// Related client
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Client Client { get; set; } = null!;
}