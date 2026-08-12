using AleTrack.Common.Authorization;
using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.RoleCapabilities.Commands.Set;
using AleTrack.Features.RoleCapabilities.Shared;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using Moq.EntityFrameworkCore;

namespace AleTrack.Tests.Features.RoleCapabilities;

/// <summary>
/// The PUT handler upserts only the (role, key) pairs its payload names. Two regressions are
/// guarded here.
/// <para>
/// First, destructiveness. The handler once replaced the whole <c>role_capabilities</c> table
/// (<c>RemoveRange(all)</c> then <c>AddRange(payload)</c>) from a payload built out of the
/// frontend registry, so dropping a key from that registry deleted its stored row on the next
/// save — silently re-opening default-allow for a capability an endpoint still gates on with
/// <c>RequireCapability</c>.
/// </para>
/// <para>
/// Second, the transaction. The replace-everything version wrapped its writes in
/// <c>BeginTransactionAsync</c>, which fails at runtime because this DbContext registers a
/// retrying execution strategy (<c>BrokenConnectionRetryStrategy</c>) and EF refuses
/// user-initiated transactions under one. Updating in place keeps the handler to a single
/// <c>SaveChangesAsync</c>, which needs no transaction at all — so these tests deliberately mock
/// no <c>Database</c> member, and re-introducing a transaction would fail against that absence.
/// </para>
/// <para>
/// Assertions inspect the tracked entity instances and what was handed to <c>Add</c>, rather than
/// re-querying <see cref="AleTrackDbContext.RoleCapabilities"/> afterward: the mocked
/// <c>DbSet&lt;RoleCapability&gt;</c> (Moq.EntityFrameworkCore's <c>ReturnsDbSet</c>) does not
/// mutate its backing collection, so a post-hoc query would pass regardless.
/// </para>
/// </summary>
public sealed class SetRoleCapabilitiesEndpointTests
{
    private static (
        List<RoleCapability> AddedRows,
        SetRoleCapabilitiesEndpoint Endpoint) CreateSut(List<RoleCapability> existingRows)
    {
        var dbContext = new Mock<AleTrackDbContext>(new DbContextOptions<AleTrackDbContext>());
        dbContext.Setup(x => x.RoleCapabilities).ReturnsDbSet(existingRows);

        var addedRows = new List<RoleCapability>();
        Mock.Get(dbContext.Object.RoleCapabilities)
            .Setup(x => x.Add(It.IsAny<RoleCapability>()))
            .Callback<RoleCapability>(addedRows.Add);

        var policy = new RoleCapabilityPolicy(dbContext.Object, new MemoryCache(new MemoryCacheOptions()));
        var endpoint = EndpointBuilder<SetRoleCapabilitiesDto, SetRoleCapabilitiesEndpoint>.Create(
            dbContext.Object, policy);

        return (addedRows, endpoint);
    }

    private static SetRoleCapabilitiesDto Payload(UserRoleType role, string capabilityKey, bool isVisible) =>
        new() { Items = [new RoleCapabilityDto { Role = role, CapabilityKey = capabilityKey, IsVisible = isVisible }] };

    /// <summary>
    /// The destructiveness guard: a stored pair the payload never mentions keeps its value and is
    /// not re-inserted. Fails if the handler goes back to clearing the table.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PayloadOmitsAStoredKey_LeavesThatRowUntouched()
    {
        var untouchedRow = new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = "Money", IsVisible = false
        };
        var targetedRow = new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = false
        };
        var (addedRows, endpoint) = CreateSut([untouchedRow, targetedRow]);

        await endpoint.HandleAsync(
            Payload(UserRoleType.Driver, nameof(Capability.Invoicing), isVisible: true),
            CancellationToken.None);

        untouchedRow.IsVisible.Should().BeFalse();
        addedRows.Should().BeEmpty();
    }

    /// <summary>
    /// A pair the payload does name is updated in place — not deleted and re-inserted, which is
    /// what let the unique index on (role, capability_key) come into play.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PayloadTargetsAnExistingKey_UpdatesItInPlace()
    {
        var targetedRow = new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = false
        };
        var (addedRows, endpoint) = CreateSut([targetedRow]);

        await endpoint.HandleAsync(
            Payload(UserRoleType.Driver, nameof(Capability.Invoicing), isVisible: true),
            CancellationToken.None);

        targetedRow.IsVisible.Should().BeTrue();
        addedRows.Should().BeEmpty();
    }

    /// <summary>
    /// Matching is case-insensitive, consistent with <see cref="RoleCapabilityPolicy"/>'s read
    /// side. Under a case-sensitive comparison the stored row would survive at its old value and
    /// a second row would be inserted for the same capability — two rows the policy then folds
    /// together, with no defined winner.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PayloadKeyDiffersOnlyByCase_UpdatesTheStoredRow()
    {
        var storedRow = new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = false
        };
        var (addedRows, endpoint) = CreateSut([storedRow]);

        await endpoint.HandleAsync(
            Payload(UserRoleType.Driver, "Invoicing", isVisible: true),
            CancellationToken.None);

        storedRow.IsVisible.Should().BeTrue();
        addedRows.Should().BeEmpty();
    }

    /// <summary>
    /// A row for a role the payload never mentions survives too — matching is per (role, key),
    /// not per key.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PayloadOmitsARole_LeavesThatRolesRowUntouched()
    {
        var managerRow = new RoleCapability
        {
            Role = UserRoleType.Manager, CapabilityKey = nameof(Capability.Invoicing), IsVisible = false
        };
        var driverRow = new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = false
        };
        var (addedRows, endpoint) = CreateSut([managerRow, driverRow]);

        await endpoint.HandleAsync(
            Payload(UserRoleType.Driver, nameof(Capability.Invoicing), isVisible: true),
            CancellationToken.None);

        managerRow.IsVisible.Should().BeFalse();
        driverRow.IsVisible.Should().BeTrue();
        addedRows.Should().BeEmpty();
    }

    /// <summary>
    /// A pair with no stored row is inserted — the "default-allow row does not exist yet" case,
    /// which is every capability the first time an admin saves.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PayloadNamesAnUnstoredKey_InsertsIt()
    {
        var (addedRows, endpoint) = CreateSut([]);

        await endpoint.HandleAsync(
            Payload(UserRoleType.Driver, nameof(Capability.LoadingBreakdown), isVisible: false),
            CancellationToken.None);

        addedRows.Should().ContainSingle(row =>
            row.Role == UserRoleType.Driver
            && row.CapabilityKey == nameof(Capability.LoadingBreakdown)
            && !row.IsVisible);
    }
}
