using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a refresh token issued to a user
/// </summary>
[Table("refresh_tokens")]
[Index(nameof(Token), IsUnique = true)]
public sealed class RefreshToken : BaseEntity
{
    /// <summary>
    /// ID of the user this token belongs to
    /// </summary>
    [Column("user_id")]
    public long UserId { get; set; }

    /// <summary>
    /// The refresh token string
    /// </summary>
    [Column("token")]
    [MaxLength(128)]
    [Required]
    public string Token { get; set; } = null!;

    /// <summary>
    /// When this token expires
    /// </summary>
    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// When this token was created
    /// </summary>
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Whether this token has been revoked
    /// </summary>
    [Column("is_revoked")]
    public bool IsRevoked { get; set; }

    /// <summary>
    /// The user this token belongs to
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public User User { get; set; } = null!;
}
