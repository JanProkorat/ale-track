using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Visibility of one <see cref="Capability"/> for one <see cref="UserRoleType"/>. The table is
/// default-allow: the absence of a row means the capability is visible, so adding a capability
/// cannot accidentally hide it from every role. Admin is never stored — it bypasses capabilities.
/// </summary>
[Table("role_capabilities")]
public sealed class RoleCapability : BaseEntity
{
    /// <summary>
    /// The role this row applies to.
    /// </summary>
    [Column("role")]
    public UserRoleType Role { get; set; }

    /// <summary>
    /// Key of the capability. Matches a <see cref="Capability"/> name for capabilities enforced
    /// server-side, or a frontend-only key for cosmetic ones.
    /// </summary>
    [Required]
    [MaxLength(64)]
    [Column("capability_key")]
    public string CapabilityKey { get; set; } = null!;

    /// <summary>
    /// Whether the role may see it.
    /// </summary>
    [Column("is_visible")]
    public bool IsVisible { get; set; }
}
