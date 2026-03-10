using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Users.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Users.Commands.Login;

/// <summary>
/// Request to login user
/// </summary>
public sealed record LoginRequest
{
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody] 
    public LoginUserDto Data { get; set; } = null!;
}

/// <summary>
/// Response containing the access token for a successful login.
/// </summary>
public sealed record LoginResponse
{
    /// <summary>
    /// Valid access token
    /// </summary>
    public string AccessToken { get; set; } = null!;

    /// <summary>
    /// Refresh token for obtaining new access tokens
    /// </summary>
    public string RefreshToken { get; set; } = null!;
}

/// <summary>
/// Endpoint to log user into the system
/// </summary>
public sealed class LoginEndpoint(AleTrackDbContext dbContext, IPasswordHasher passwordHasher, IJwtService jwtService) : 
    Endpoint<LoginRequest, LoginResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("login");
        Description(b => b
            .Produces<LoginResponse>()
            .WithName(nameof(LoginEndpoint)));

        DontCatchExceptions();
        AllowAnonymous();

        Summary(s =>
            {
                s.Summary = "Login user into the system";
                s.Responses[StatusCodes.Status200OK] = "User logged in";
                s.Responses[StatusCodes.Status401Unauthorized] = "User not authorized";
            }
        );
    }
    
    /// <inheritdoc />
    public override async Task HandleAsync(LoginRequest req, CancellationToken ct)
    {
        var user = await dbContext.Users
            .Include(u => u.UserRoles)
            .FirstOrDefaultAsync(u => u.UserName == req.Data.UserName, ct);
            
        if (user is null)
            UserThrowHelper.UserNotFound(req.Data.UserName);
        
        var isPasswordValid = passwordHasher.VerifyPassword(req.Data.Password, user!.Password);
        if (!isPasswordValid)
            UserThrowHelper.InvalidPassword();

        var accessToken = jwtService.GenerateToken(user);
        var refreshTokenString = jwtService.GenerateRefreshToken();
        var refreshToken = new RefreshToken
        {
            User = user,
            Token = refreshTokenString,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Set<RefreshToken>().Add(refreshToken);
        await dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(new LoginResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshTokenString
        }, cancellation: ct);

    }
}