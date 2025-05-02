using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Common.Utils;

/// <summary>
/// Provides methods for generating JSON Web Tokens (JWT) for users.
/// </summary>
public interface IJwtService
{
    /// <summary>
    /// Generates a JWT token for the specified user and their roles.
    /// </summary>
    /// <param name="user">The user for whom the token is to be generated.</param>
    /// <returns>Returns a JWT token as a string.</returns>
    string GenerateToken(User user);
}