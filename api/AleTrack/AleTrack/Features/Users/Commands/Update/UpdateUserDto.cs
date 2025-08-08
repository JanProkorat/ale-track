using AleTrack.Common.Enums;

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
}