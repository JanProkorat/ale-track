using AleTrack.Common.Authorization;
using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using Moq.EntityFrameworkCore;

namespace AleTrack.Tests.Common.Authorization;

/// <summary>
/// The cached read of role_capabilities. Default-allow is the load-bearing behaviour: a
/// capability with no row must come back visible.
/// </summary>
public sealed class RoleCapabilityPolicyTests
{
    private static RoleCapabilityPolicy PolicyOver(params RoleCapability[] rows)
    {
        var dbContext = new Mock<AleTrackDbContext>(new DbContextOptions<AleTrackDbContext>());
        dbContext.Setup(x => x.RoleCapabilities).ReturnsDbSet(rows);

        return new RoleCapabilityPolicy(dbContext.Object, new MemoryCache(new MemoryCacheOptions()));
    }

    [Fact]
    public async Task GetHiddenKeysAsync_RowIsNotVisible_KeyIsHidden()
    {
        var policy = PolicyOver(new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = false
        });

        (await policy.GetHiddenKeysAsync(UserRoleType.Driver, CancellationToken.None))
            .Should().BeEquivalentTo(["invoicing"]);
    }

    [Fact]
    public async Task GetHiddenKeysAsync_RowIsVisible_KeyIsNotHidden()
    {
        var policy = PolicyOver(new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = true
        });

        (await policy.GetHiddenKeysAsync(UserRoleType.Driver, CancellationToken.None))
            .Should().BeEmpty();
    }

    [Fact]
    public async Task GetHiddenKeysAsync_NoRowsForRole_HidesNothing()
    {
        var policy = PolicyOver(new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = false
        });

        (await policy.GetHiddenKeysAsync(UserRoleType.Manager, CancellationToken.None))
            .Should().BeEmpty();
    }
}
