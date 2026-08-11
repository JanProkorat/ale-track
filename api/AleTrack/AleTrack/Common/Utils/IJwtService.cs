using AleTrack.Entities;

namespace AleTrack.Common.Utils;

/// <summary>
/// Provides methods for generating JSON Web Tokens (JWT) for users.
/// </summary>
public interface IJwtService
{
    /// <summary>
    /// Issues an access token for <paramref name="user"/>, stamping the capability keys their
    /// roles may not see.
    /// </summary>
    Task<string> GenerateTokenAsync(User user, CancellationToken ct);

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