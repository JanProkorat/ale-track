using System.IdentityModel.Tokens.Jwt;
using AleTrack.Common.Authorization;
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Moq;
using Moq.EntityFrameworkCore;

namespace AleTrack.Tests.Common.Utils;

/// <summary>
/// The token carries the role's hidden capability keys, so the frontend reads policy from its
/// own token instead of holding a copy of the backend's table.
/// </summary>
public sealed class JwtServiceCapabilityClaimTests
{
    private static JwtService ServiceOver(params RoleCapability[] rows)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JWT_Issuer"] = "AleTrackAPI",
                ["JWT_Key"] = "eb58baa8f90d76949d7f52f88c97bd916484c08f9d5cd6394602963be325c38b"
            })
            .Build();

        var dbContext = new Mock<AleTrackDbContext>(new DbContextOptions<AleTrackDbContext>());
        dbContext.Setup(x => x.RoleCapabilities).ReturnsDbSet(rows);

        return new JwtService(
            configuration,
            new RoleCapabilityPolicy(dbContext.Object, new MemoryCache(new MemoryCacheOptions())));
    }

    private static User DriverUser() => new()
    {
        UserName = "novak",
        Password = "hash",
        UserRoles = [new UserRole { Type = UserRoleType.Driver }]
    };

    [Fact]
    public async Task GenerateTokenAsync_RoleHasHiddenCapabilities_EmitsOneCapClaimEach()
    {
        var service = ServiceOver(
            new RoleCapability { Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = false },
            new RoleCapability { Role = UserRoleType.Driver, CapabilityKey = "money", IsVisible = false });

        var token = await service.GenerateTokenAsync(DriverUser(), CancellationToken.None);

        var claims = new JwtSecurityTokenHandler().ReadJwtToken(token).Claims
            .Where(c => c.Type == JwtService.CapabilityClaimType)
            .Select(c => c.Value);

        claims.Should().BeEquivalentTo(["invoicing", "money"]);
    }

    [Fact]
    public async Task GenerateTokenAsync_NothingHidden_EmitsNoCapClaims()
    {
        var service = ServiceOver(
            new RoleCapability { Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = true });

        var token = await service.GenerateTokenAsync(DriverUser(), CancellationToken.None);

        new JwtSecurityTokenHandler().ReadJwtToken(token).Claims
            .Should().NotContain(c => c.Type == JwtService.CapabilityClaimType);
    }
}
