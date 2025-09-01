using AleTrack.Common.Enums;

namespace AleTrack.Common.Utils;

/// <summary>
/// Represents the application context that provides information
/// about the currently authenticated user and their roles within the system.
/// </summary>
public interface IAppContext
{
    /// <summary>
    /// Gets the unique identifier of the currently authenticated user.
    /// </summary>
    /// <remarks>
    /// This property retrieves the GUID associated with the authenticated user
    /// from the claim data. If no user is authenticated or the identifier cannot
    /// be parsed as a GUID, the property will return null.
    /// </remarks>
    Guid? UserId { get; }

    /// <summary>
    /// Gets the username of the currently authenticated user.
    /// </summary>
    /// <remarks>
    /// Retrieves the name of the user from the authentication claims.
    /// If no user is authenticated or if the username cannot be found in the claims, the property returns null.
    /// </remarks>
    string? UserName { get; }

    /// <summary>
    /// Gets the list of roles assigned to the currently authenticated user.
    /// </summary>
    /// <remarks>
    /// This property retrieves the roles of the authenticated user from the claim data
    /// and parses them into the list of <see cref="UserRoleType"/>. If no roles are found,
    /// an empty list will be returned.
    /// </remarks>
    List<UserRoleType> Roles { get; }
}