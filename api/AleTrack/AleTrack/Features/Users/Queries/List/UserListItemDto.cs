using AleTrack.Common.Enums;

namespace AleTrack.Features.Users.Queries.List;

public sealed record UserListItemDto
{
    /// <summary>
    /// Public ID of the user
    /// </summary>
    public Guid Id { get; set; }
    
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
    /// List of related roles
    /// </summary>
    public List<UserRoleType> UserRoles { get; set; } = [];
}