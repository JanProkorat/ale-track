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
    private static (RoleCapabilityPolicy Policy, Mock<AleTrackDbContext> DbContext) PolicyOver(
        params RoleCapability[] rows)
    {
        var dbContext = new Mock<AleTrackDbContext>(new DbContextOptions<AleTrackDbContext>());
        dbContext.Setup(x => x.RoleCapabilities).ReturnsDbSet(rows);

        return (new RoleCapabilityPolicy(dbContext.Object, new MemoryCache(new MemoryCacheOptions())), dbContext);
    }

    [Fact]
    public async Task GetHiddenKeysAsync_RowIsNotVisible_KeyIsHidden()
    {
        var (policy, _) = PolicyOver(new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = false
        });

        (await policy.GetHiddenKeysAsync(UserRoleType.Driver, CancellationToken.None))
            .Should().BeEquivalentTo([nameof(Capability.Invoicing)]);
    }

    [Fact]
    public async Task GetHiddenKeysAsync_RowIsVisible_KeyIsNotHidden()
    {
        var (policy, _) = PolicyOver(new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = true
        });

        (await policy.GetHiddenKeysAsync(UserRoleType.Driver, CancellationToken.None))
            .Should().BeEmpty();
    }

    [Fact]
    public async Task GetHiddenKeysAsync_NoRowsForRole_HidesNothing()
    {
        var (policy, _) = PolicyOver(new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = false
        });

        (await policy.GetHiddenKeysAsync(UserRoleType.Manager, CancellationToken.None))
            .Should().BeEmpty();
    }

    /// <summary>
    /// The guard on the whole casing seam: the migration writes PascalCase keys matching the
    /// <see cref="Capability"/> enum names, but a row saved with different casing must still
    /// match the lookup. This is the behaviour that breaks silently if the comparer is ever
    /// reverted to <see cref="StringComparer.Ordinal"/> — the gate would stay open for a
    /// lowercase-saved key instead of closing.
    /// </summary>
    [Fact]
    public async Task GetHiddenKeysAsync_RowKeyDiffersOnlyByCase_KeyIsStillHidden()
    {
        var (policy, _) = PolicyOver(new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = false
        });

        (await policy.GetHiddenKeysAsync(UserRoleType.Driver, CancellationToken.None))
            .Should().Contain(nameof(Capability.Invoicing));
    }

    /// <summary>
    /// The point of caching: a second call within the cache window must not hit the database
    /// again. Deleting the <c>cache.Set</c> call would still pass every other test in this file
    /// while querying the database on every gated request.
    /// </summary>
    [Fact]
    public async Task GetHiddenKeysAsync_CalledTwice_ReadsTheTableOnlyOnce()
    {
        var (policy, dbContext) = PolicyOver(new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = false
        });

        await policy.GetHiddenKeysAsync(UserRoleType.Driver, CancellationToken.None);
        await policy.GetHiddenKeysAsync(UserRoleType.Driver, CancellationToken.None);

        dbContext.VerifyGet(x => x.RoleCapabilities, Times.Once);
    }

    /// <summary>
    /// <see cref="RoleCapabilityPolicy.Invalidate"/> is Task 5's write-side hook: after a saved
    /// change it must force the next read back to the database rather than serving the stale
    /// cached map.
    /// </summary>
    [Fact]
    public async Task GetHiddenKeysAsync_CalledAfterInvalidate_ReadsTheTableAgain()
    {
        var (policy, dbContext) = PolicyOver(new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = false
        });

        await policy.GetHiddenKeysAsync(UserRoleType.Driver, CancellationToken.None);
        policy.Invalidate();
        await policy.GetHiddenKeysAsync(UserRoleType.Driver, CancellationToken.None);

        dbContext.VerifyGet(x => x.RoleCapabilities, Times.Exactly(2));
    }

    /// <summary>
    /// The absolute-expiration backstop (2 minutes) is what protects a multi-instance deployment
    /// or a direct database edit from an indefinitely stale cache — <see cref="Invalidate"/> alone
    /// only reaches the instance that served the save. Verified by inspecting the cache entry
    /// options at the point of the write, since a real elapsed-time assertion would need a clock
    /// abstraction this codebase's <see cref="MemoryCache"/> usage does not have (no
    /// <c>TimeProvider</c> hook on <see cref="MemoryCacheOptions"/> in the referenced package
    /// version).
    /// </summary>
    [Fact]
    public async Task GetHiddenKeysAsync_CacheMiss_SetsATwoMinuteAbsoluteExpiration()
    {
        var dbContext = new Mock<AleTrackDbContext>(new DbContextOptions<AleTrackDbContext>());
        dbContext.Setup(x => x.RoleCapabilities).ReturnsDbSet(Array.Empty<RoleCapability>());

        var cacheEntry = new Mock<ICacheEntry>();
        cacheEntry.SetupAllProperties();

        var cache = new Mock<IMemoryCache>();
        object? ignoredCachedValue;
        cache.Setup(x => x.TryGetValue(RoleCapabilityPolicy.CacheKey, out ignoredCachedValue)).Returns(false);
        cache.Setup(x => x.CreateEntry(RoleCapabilityPolicy.CacheKey)).Returns(cacheEntry.Object);

        var policy = new RoleCapabilityPolicy(dbContext.Object, cache.Object);

        await policy.GetHiddenKeysAsync(UserRoleType.Driver, CancellationToken.None);

        cacheEntry.Object.AbsoluteExpirationRelativeToNow.Should().Be(TimeSpan.FromMinutes(2));
    }
}
