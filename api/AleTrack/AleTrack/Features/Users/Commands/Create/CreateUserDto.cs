using AleTrack.Common.Enums;

namespace AleTrack.Features.Users.Commands.Create;

/// <summary>
/// Represents the data transfer object used for creating a new user.
/// Encapsulates the necessary information for a user creation request.
/// </summary>
public sealed record CreateUserDto
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
    /// Username used to log in
    /// </summary>
    public string UserName { get; set; } = null!;

    /// <summary>
    /// User password
    /// </summary>
    public string Password { get; set; } = null!;
    
    /// <summary>
    /// List of related roles
    /// </summary>
    public List<UserRoleType> UserRoles { get; set; } = [];
}