using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Users.Commands.Login;
using AleTrack.Features.Users.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Users.Commands.Refresh;

/// <summary>
/// Request to refresh an access token
/// </summary>
public sealed record RefreshTokenRequest
{
    /// <summary>
    /// The refresh token to use
    /// </summary>
    [FromBody]
    public RefreshTokenDto Data { get; set; } = null!;
}

/// <summary>
/// DTO containing the refresh token
/// </summary>
public sealed record RefreshTokenDto
{
    /// <summary>
    /// The refresh token string
    /// </summary>
    public string RefreshToken { get; set; } = null!;
}

/// <summary>
/// Endpoint to refresh an access token using a refresh token
/// </summary>
public sealed class RefreshTokenEndpoint(AleTrackDbContext dbContext, IJwtService jwtService, IConfiguration configuration) :
    Endpoint<RefreshTokenRequest, LoginResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("refresh");
        Description(b => b
            .Produces<LoginResponse>()
            .WithName(nameof(RefreshTokenEndpoint)));

        DontCatchExceptions();
        AllowAnonymous();

        Summary(s =>
        {
            s.Summary = "Refresh an access token using a refresh token";
            s.Responses[StatusCodes.Status200OK] = "Token refreshed";
            s.Responses[StatusCodes.Status401Unauthorized] = "Invalid or expired refresh token";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(RefreshTokenRequest req, CancellationToken ct)
    {
        var hashedToken = jwtService.HashToken(req.Data.RefreshToken);

        var existingToken = await dbContext.RefreshTokens
            .Include(rt => rt.User)
                .ThenInclude(u => u.UserRoles)
            .FirstOrDefaultAsync(rt => rt.Token == hashedToken, ct);

        if (existingToken is null || existingToken.IsRevoked || existingToken.ExpiresAt < DateTime.UtcNow)
            UserThrowHelper.InvalidRefreshToken();

        var user = existingToken.User;

        // Remove the used refresh token (rotation)
        dbContext.RefreshTokens.Remove(existingToken);

        // Clean up expired tokens for this user
        var expiredTokens = await dbContext.RefreshTokens
            .Where(rt => rt.UserId == user.Id && rt.ExpiresAt < DateTime.UtcNow)
            .ToListAsync(ct);
        dbContext.RefreshTokens.RemoveRange(expiredTokens);

        // Generate new tokens
        var (accessToken, rawRefreshToken) = RefreshTokenHelper.CreateTokens(
            jwtService, dbContext, user, configuration);
        await dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(new LoginResponse
        {
            AccessToken = accessToken,
            RefreshToken = rawRefreshToken
        }, cancellation: ct);
    }
}
