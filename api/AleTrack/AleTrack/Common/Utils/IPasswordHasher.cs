namespace AleTrack.Common.Utils;

/// <summary>
/// Provides methods for hashing passwords and verifying password hashes.
/// </summary>
public interface IPasswordHasher
{
    /// <summary>
    /// Creates a hashed representation of the specified password.
    /// </summary>
    /// <param name="password">The plain text password to hash.</param>
    /// <returns>A hashed string of the provided password.</returns>
    string HashPassword(string password);

    /// <summary>
    /// Verifies if the specified plain text password matches its hashed representation.
    /// </summary>
    /// <param name="password">The plain text password to verify.</param>
    /// <param name="passwordHash">The hashed password to compare against.</param>
    /// <returns>True if the password matches the hash; otherwise, false.</returns>
    bool VerifyPassword(string password, string passwordHash);
}