using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;

namespace AleTrack.Features.Users.Utils;

/// <summary>
/// Helper for creating and persisting refresh tokens.
/// </summary>
public static class RefreshTokenHelper
{
    /// <summary>
    /// Generates a new access token and refresh token pair, persists the hashed refresh token to the database.
    /// </summary>
    /// <returns>A tuple of (accessToken, rawRefreshToken). The raw refresh token is returned to the client; the hashed version is stored.</returns>
    public static (string AccessToken, string RawRefreshToken) CreateTokens(
        IJwtService jwtService,
        AleTrackDbContext dbContext,
        User user,
        IConfiguration configuration)
    {
        var accessToken = jwtService.GenerateToken(user);
        var rawRefreshToken = jwtService.GenerateRefreshToken();
        var hashedToken = jwtService.HashToken(rawRefreshToken);

        var refreshTokenExpirationDays = configuration.GetValue("Jwt:RefreshTokenExpirationDays", 7);

        var refreshToken = new RefreshToken
        {
            User = user,
            Token = hashedToken,
            ExpiresAt = DateTime.UtcNow.AddDays(refreshTokenExpirationDays),
            CreatedAt = DateTime.UtcNow
        };

        dbContext.RefreshTokens.Add(refreshToken);

        return (accessToken, rawRefreshToken);
    }
}
