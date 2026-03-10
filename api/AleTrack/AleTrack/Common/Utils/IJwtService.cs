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

    /// <summary>
    /// Generates a cryptographically random refresh token string.
    /// </summary>
    /// <returns>A random token string.</returns>
    string GenerateRefreshToken();

    /// <summary>
    /// Hashes a refresh token using SHA-256 for secure storage.
    /// </summary>
    /// <param name="token">The raw refresh token to hash.</param>
    /// <returns>A base64-encoded SHA-256 hash of the token.</returns>
    string HashToken(string token);
}