using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Users.Commands.Login;
using AleTrack.Features.Users.Commands.Refresh;
using AleTrack.Features.Users.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Moq;

namespace AleTrack.Tests.Features.Users;

public sealed class RefreshTokenTests
{
    private static IConfiguration CreateTestConfiguration()
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:AccessTokenExpirationHours"] = "1",
                ["Jwt:RefreshTokenExpirationDays"] = "7"
            })
            .Build();
    }

    [Fact]
    public async Task ProcessAsync_RefreshToken_Success()
    {
        var rawToken = "valid-refresh-token";
        var hashedToken = "hashed-token";
        var newAccessToken = "new-access-token";
        var newRefreshToken = "new-refresh-token";

        var user = UserBuilder.BuildEntity();
        var refreshToken = new RefreshToken
        {
            Id = 1,
            UserId = user.Id,
            User = user,
            Token = hashedToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            IsRevoked = false
        };

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            users: [user],
            refreshTokens: [refreshToken]);
        var jwtService = new Mock<IJwtService>();
        var configuration = CreateTestConfiguration();

        jwtService.Setup(j => j.HashToken(rawToken)).Returns(hashedToken);
        jwtService.Setup(j => j.GenerateToken(user)).Returns(newAccessToken);
        jwtService.Setup(j => j.GenerateRefreshToken()).Returns(newRefreshToken);
        jwtService.Setup(j => j.HashToken(newRefreshToken)).Returns("new-hashed-token");

        var command = new RefreshTokenRequest
        {
            Data = new RefreshTokenDto { RefreshToken = rawToken }
        };

        var endpoint = EndpointWithResponseBuilder<RefreshTokenRequest, LoginResponse, RefreshTokenEndpoint>
            .Create(dbContext.Object, jwtService.Object, configuration);
        await endpoint.HandleAsync(command, CancellationToken.None);

        jwtService.Verify(j => j.HashToken(rawToken), Times.Once);
        jwtService.Verify(j => j.GenerateToken(user), Times.Once);
        jwtService.Verify(j => j.GenerateRefreshToken(), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_RefreshToken_InvalidToken()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();
        var jwtService = new Mock<IJwtService>();
        var configuration = CreateTestConfiguration();

        jwtService.Setup(j => j.HashToken(It.IsAny<string>())).Returns("nonexistent-hash");

        var command = new RefreshTokenRequest
        {
            Data = new RefreshTokenDto { RefreshToken = "invalid-token" }
        };

        var endpoint = EndpointWithResponseBuilder<RefreshTokenRequest, LoginResponse, RefreshTokenEndpoint>
            .Create(dbContext.Object, jwtService.Object, configuration);

        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.StatusCode == StatusCodes.Status401Unauthorized &&
                       e.ErrorCode == UserErrorCodes.InvalidRefreshTokenError);
    }

    [Fact]
    public async Task ProcessAsync_RefreshToken_ExpiredToken()
    {
        var rawToken = "expired-token";
        var hashedToken = "hashed-expired";

        var user = UserBuilder.BuildEntity();
        var refreshToken = new RefreshToken
        {
            Id = 1,
            UserId = user.Id,
            User = user,
            Token = hashedToken,
            ExpiresAt = DateTime.UtcNow.AddDays(-1),
            CreatedAt = DateTime.UtcNow.AddDays(-8),
            IsRevoked = false
        };

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            users: [user],
            refreshTokens: [refreshToken]);
        var jwtService = new Mock<IJwtService>();
        var configuration = CreateTestConfiguration();

        jwtService.Setup(j => j.HashToken(rawToken)).Returns(hashedToken);

        var command = new RefreshTokenRequest
        {
            Data = new RefreshTokenDto { RefreshToken = rawToken }
        };

        var endpoint = EndpointWithResponseBuilder<RefreshTokenRequest, LoginResponse, RefreshTokenEndpoint>
            .Create(dbContext.Object, jwtService.Object, configuration);

        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.StatusCode == StatusCodes.Status401Unauthorized &&
                       e.ErrorCode == UserErrorCodes.InvalidRefreshTokenError);
    }

    [Fact]
    public async Task ProcessAsync_RefreshToken_RevokedToken()
    {
        var rawToken = "revoked-token";
        var hashedToken = "hashed-revoked";

        var user = UserBuilder.BuildEntity();
        var refreshToken = new RefreshToken
        {
            Id = 1,
            UserId = user.Id,
            User = user,
            Token = hashedToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            IsRevoked = true
        };

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            users: [user],
            refreshTokens: [refreshToken]);
        var jwtService = new Mock<IJwtService>();
        var configuration = CreateTestConfiguration();

        jwtService.Setup(j => j.HashToken(rawToken)).Returns(hashedToken);

        var command = new RefreshTokenRequest
        {
            Data = new RefreshTokenDto { RefreshToken = rawToken }
        };

        var endpoint = EndpointWithResponseBuilder<RefreshTokenRequest, LoginResponse, RefreshTokenEndpoint>
            .Create(dbContext.Object, jwtService.Object, configuration);

        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.StatusCode == StatusCodes.Status401Unauthorized &&
                       e.ErrorCode == UserErrorCodes.InvalidRefreshTokenError);
    }
}
