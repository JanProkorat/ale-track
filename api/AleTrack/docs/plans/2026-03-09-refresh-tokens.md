# Refresh Token Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add refresh token support so users stay logged in for 7 days without re-entering credentials, while shortening access token lifetime to 1 hour.

**Architecture:** Login and refresh endpoints both return an access token (1h JWT) + refresh token (random string, 7d, stored in DB). Each refresh rotates the token. Expired tokens are cleaned up opportunistically.

**Tech Stack:** ASP.NET, EF Core, FastEndpoints, PostgreSQL

---

### Task 1: Create RefreshToken Entity

**Files:**
- Create: `AleTrack/Entities/RefreshToken.cs`

**Step 1: Create the entity**

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a refresh token issued to a user
/// </summary>
[Table("refresh_tokens")]
[Index(nameof(Token), IsUnique = true)]
public sealed class RefreshToken : BaseEntity
{
    /// <summary>
    /// ID of the user this token belongs to
    /// </summary>
    [Column("user_id")]
    public long UserId { get; set; }

    /// <summary>
    /// The refresh token string
    /// </summary>
    [Column("token")]
    [MaxLength(128)]
    [Required]
    public string Token { get; set; } = null!;

    /// <summary>
    /// When this token expires
    /// </summary>
    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// When this token was created
    /// </summary>
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// The user this token belongs to
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public User User { get; set; } = null!;
}
```

**Step 2: Add navigation property to User entity**

Modify: `AleTrack/Entities/User.cs` — add after `UserRoles` collection:

```csharp
/// <summary>
/// List of refresh tokens issued to this user
/// </summary>
public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
```

**Step 3: Commit**

```bash
git add AleTrack/Entities/RefreshToken.cs AleTrack/Entities/User.cs
git commit -m "feat: add RefreshToken entity"
```

---

### Task 2: Create EF Migration

**Step 1: Generate migration**

```bash
dotnet ef migrations add RefreshTokens --project AleTrack/AleTrack.csproj
```

**Step 2: Verify the migration creates the `refresh_tokens` table with correct columns and FK**

**Step 3: Commit**

```bash
git add AleTrack/Infrastructure/Persistence/Migrations/
git commit -m "feat: add RefreshTokens migration"
```

---

### Task 3: Change Access Token Lifetime

**Files:**
- Modify: `AleTrack/Common/Utils/JwtService.cs:32`

**Step 1: Change token expiry from 24h to 1h**

Change line 32 from:
```csharp
expires: DateTime.Now.AddHours(24), // Token valid for 24 hours
```
to:
```csharp
expires: DateTime.UtcNow.AddHours(1),
```

**Step 2: Commit**

```bash
git add AleTrack/Common/Utils/JwtService.cs
git commit -m "feat: shorten access token lifetime to 1 hour"
```

---

### Task 4: Add Refresh Token Generation to IJwtService

**Files:**
- Modify: `AleTrack/Common/Utils/IJwtService.cs`
- Modify: `AleTrack/Common/Utils/JwtService.cs`

**Step 1: Add method to interface**

Add to `IJwtService.cs`:
```csharp
/// <summary>
/// Generates a cryptographically random refresh token string.
/// </summary>
/// <returns>A random token string.</returns>
string GenerateRefreshToken();
```

**Step 2: Implement in JwtService**

Add to `JwtService.cs`:
```csharp
/// <inheritdoc/>
public string GenerateRefreshToken()
{
    var randomBytes = new byte[64];
    using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
    rng.GetBytes(randomBytes);
    return Convert.ToBase64String(randomBytes);
}
```

**Step 3: Commit**

```bash
git add AleTrack/Common/Utils/IJwtService.cs AleTrack/Common/Utils/JwtService.cs
git commit -m "feat: add refresh token generation to JwtService"
```

---

### Task 5: Update Login Endpoint to Return Refresh Token

**Files:**
- Modify: `AleTrack/Features/Users/Commands/Login/LoginEndpoint.cs`

**Step 1: Update LoginResponse to include RefreshToken**

Change `LoginResponse` (line 24-30) to:
```csharp
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
```

**Step 2: Update HandleAsync to create and return refresh token**

After `var accessToken = jwtService.GenerateToken(user);` (line 72), add:
```csharp
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
```

Update the response (line 74-77) to:
```csharp
await Send.OkAsync(new LoginResponse
{
    AccessToken = accessToken,
    RefreshToken = refreshTokenString
}, cancellation: ct);
```

Add `using AleTrack.Entities;` to imports.

**Step 3: Commit**

```bash
git add AleTrack/Features/Users/Commands/Login/LoginEndpoint.cs
git commit -m "feat: return refresh token from login endpoint"
```

---

### Task 6: Create Refresh Token Endpoint

**Files:**
- Create: `AleTrack/Features/Users/Commands/Refresh/RefreshTokenEndpoint.cs`
- Create: `AleTrack/Features/Users/Commands/Refresh/RefreshTokenValidator.cs`

**Step 1: Create the endpoint**

```csharp
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
public sealed class RefreshTokenEndpoint(AleTrackDbContext dbContext, IJwtService jwtService) :
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
        var existingToken = await dbContext.Set<RefreshToken>()
            .Include(rt => rt.User)
                .ThenInclude(u => u.UserRoles)
            .FirstOrDefaultAsync(rt => rt.Token == req.Data.RefreshToken, ct);

        if (existingToken is null || existingToken.ExpiresAt < DateTime.UtcNow)
            UserThrowHelper.InvalidRefreshToken();

        var user = existingToken.User;

        // Remove the used refresh token (rotation)
        dbContext.Set<RefreshToken>().Remove(existingToken);

        // Clean up expired tokens for this user
        var expiredTokens = await dbContext.Set<RefreshToken>()
            .Where(rt => rt.UserId == user.Id && rt.ExpiresAt < DateTime.UtcNow)
            .ToListAsync(ct);
        dbContext.Set<RefreshToken>().RemoveRange(expiredTokens);

        // Generate new tokens
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
```

**Step 2: Create the validator**

```csharp
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Users.Commands.Refresh;

/// <summary>
/// Validator for the refresh token request
/// </summary>
public sealed class RefreshTokenValidator : Validator<RefreshTokenRequest>
{
    public RefreshTokenValidator()
    {
        RuleFor(x => x.Data)
            .NotNull();

        RuleFor(x => x.Data.RefreshToken)
            .NotEmpty()
            .When(x => x.Data is not null);
    }
}
```

**Step 3: Commit**

```bash
git add AleTrack/Features/Users/Commands/Refresh/
git commit -m "feat: add refresh token endpoint"
```

---

### Task 7: Add InvalidRefreshToken Error

**Files:**
- Modify: `AleTrack/Features/Users/Utils/UserErrorCodes.cs`
- Modify: `AleTrack/Features/Users/Utils/UserThrowHelper.cs`

**Step 1: Add error code**

Add to `UserErrorCodes.cs`:
```csharp
/// <summary>
/// Error code for case when the provided refresh token is invalid or expired.
/// </summary>
public const string InvalidRefreshTokenError = "INVALID_REFRESH_TOKEN";
```

**Step 2: Add throw helper method**

Add to `UserThrowHelper.cs`:
```csharp
/// <summary>
/// Throws an AleTrackException indicating that the provided refresh token is invalid or expired.
/// </summary>
public static void InvalidRefreshToken()
    => throw new AleTrackException(
        StatusCodes.Status401Unauthorized,
        UserErrorCodes.InvalidRefreshTokenError);
```

**Step 3: Commit**

```bash
git add AleTrack/Features/Users/Utils/
git commit -m "feat: add InvalidRefreshToken error code and throw helper"
```

---

### Task 8: Build and Verify

**Step 1: Build the project**

```bash
dotnet build AleTrack/AleTrack.csproj
```

Expected: 0 errors.

**Step 2: Commit if any fixups needed**
