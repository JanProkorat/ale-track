namespace AleTrack.Common.Utils;

/// <inheritdoc />
internal sealed class PasswordHasher : IPasswordHasher
{
    private const int WorkFactor = 13;

    /// <inheritdoc />
    public string HashPassword(string password)
        => BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);

    /// <inheritdoc />
    public bool VerifyPassword(string password, string passwordHash)
        => BCrypt.Net.BCrypt.Verify(password, passwordHash);
}