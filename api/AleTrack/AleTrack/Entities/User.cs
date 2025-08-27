using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a system user with properties such as name, username, password, and associated user roles.
/// This entity is mapped to a table named "users" and includes a unique index on the "UserName" property.
/// </summary>
[Index(nameof(UserName), IsUnique = true)]
[Table("users")]
public sealed class User : PublicEntity
{
    /// <summary>
    /// First name
    /// </summary>
    [MaxLength(50)]
    [Column("first_name")]
    public string? FirstName { get; set; }
    
    /// <summary>
    /// Last name
    /// </summary>
    [MaxLength(50)]
    [Column("last_name")]
    public string? LastName { get; set; }

    /// <summary>
    /// Users name used to log in
    /// </summary>
    [Required]
    [MaxLength(20)]
    [Column("user_name")]
    public string UserName { get; set; } = null!;

    /// <summary>
    /// User password
    /// </summary>
    [Required]
    [MaxLength(80)]
    [Column("password")]
    public string Password { get; set; } = null!;
    
    /// <summary>
    /// List of related roles
    /// </summary>
    public ICollection<UserRole> UserRoles { get; set; } = [];
}