using AleTrack.Common.Enums;
using AleTrack.Features.Users.Models;

namespace AleTrack.Features.Users.Commands.Update;

public sealed record UpdateUserDto
{
    /// <summary>
    /// First name
    /// </summary>
    public string? FirstName { get; set; }
    
    /// <summary>
    /// Last name
    /// </summary>
    public string? LastName { get; set; }
    
    /// <summary>
    /// List of related roles
    /// </summary>
    public List<UserRoleType> UserRoles { get; set; } = [];

    /// <summary>
    /// Granular per-module permissions. Ignored for Admin-role users (they get full access).
    /// </summary>
    public List<ModulePermissionDto> Permissions { get; set; } = [];
}