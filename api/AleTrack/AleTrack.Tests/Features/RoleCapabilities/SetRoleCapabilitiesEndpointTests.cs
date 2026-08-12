using AleTrack.Common.Authorization;
using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.RoleCapabilities.Commands.Set;
using AleTrack.Features.RoleCapabilities.Shared;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using Moq.EntityFrameworkCore;

namespace AleTrack.Tests.Features.RoleCapabilities;

/// <summary>
/// The PUT handler used to replace the whole <c>role_capabilities</c> table
/// (<c>RemoveRange(all)</c> then <c>AddRange(payload)</c>), built from the frontend registry.
/// That made a registry change destructive: dropping a key from the frontend registry (e.g. a
/// rename) would delete its stored row on the next save, silently re-opening default-allow for
/// a capability an endpoint still gates on with <c>RequireCapability</c>. The fix replaces only
/// the rows whose (role, key) pair the payload actually names, so an unrelated stored row
/// survives untouched.
/// <para>
/// Assertions here inspect what was passed to <c>RemoveRange</c>/<c>AddRange</c> rather than
/// re-querying <see cref="AleTrackDbContext.RoleCapabilities"/> afterward: the mocked
/// <c>DbSet&lt;RoleCapability&gt;</c> (Moq.EntityFrameworkCore's <c>ReturnsDbSet</c>) does not
/// mutate its backing collection when those methods are called, so a post-hoc query would
/// silently pass regardless of what the handler actually removed or added.
/// </para>
/// </summary>
public sealed class SetRoleCapabilitiesEndpointTests
{
    private static (
        Mock<DbSet<RoleCapability>> RoleCapabilitiesSet,
        SetRoleCapabilitiesEndpoint Endpoint) CreateSut(List<RoleCapability> existingRows)
    {
        var dbContext = new Mock<AleTrackDbContext>(new DbContextOptions<AleTrackDbContext>());
        dbContext.Setup(x => x.RoleCapabilities).ReturnsDbSet(existingRows);
        var roleCapabilitiesSet = Mock.Get(dbContext.Object.RoleCapabilities);

        // Database.BeginTransactionAsync/CommitAsync are the pieces HandleAsync exercises;
        // DatabaseFacade's members are virtual specifically so they can be mocked like this.
        var transaction = new Mock<IDbContextTransaction>();
        var databaseFacade = new Mock<DatabaseFacade>(dbContext.Object);
        databaseFacade
            .Setup(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(transaction.Object);
        dbContext.Setup(x => x.Database).Returns(databaseFacade.Object);

        var policy = new RoleCapabilityPolicy(dbContext.Object, new MemoryCache(new MemoryCacheOptions()));
        var endpoint = EndpointBuilder<SetRoleCapabilitiesDto, SetRoleCapabilitiesEndpoint>.Create(
            dbContext.Object, policy);

        return (roleCapabilitiesSet, endpoint);
    }

    /// <summary>
    /// The regression this guards: a payload that never mentions a stored (role, key) pair must
    /// not be handed to <c>RemoveRange</c> at all. This fails if the endpoint reverts to
    /// <c>RemoveRange(await dbContext.RoleCapabilities.ToListAsync(ct))</c> — that call removes
    /// every row regardless of what the payload names, including this one.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PayloadOmitsAStoredKey_DoesNotRemoveThatRow()
    {
        var untouchedRow = new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = "Money", IsVisible = false
        };
        var targetedRow = new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = false
        };
        var (roleCapabilitiesSet, endpoint) = CreateSut([untouchedRow, targetedRow]);

        List<RoleCapability>? removedRows = null;
        roleCapabilitiesSet
            .Setup(x => x.RemoveRange(It.IsAny<IEnumerable<RoleCapability>>()))
            .Callback<IEnumerable<RoleCapability>>(rows => removedRows = rows.ToList());

        await endpoint.HandleAsync(new SetRoleCapabilitiesDto
        {
            Items = [new RoleCapabilityDto { Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = true }]
        }, CancellationToken.None);

        removedRows.Should().NotBeNull();
        removedRows.Should().NotContain(untouchedRow);
        removedRows.Should().Contain(targetedRow);
    }

    /// <summary>
    /// The counterpart of the guard above: a (role, key) pair the payload does name must still
    /// be removed (so the fresh row from <c>AddRange</c> replaces it) and re-added with the
    /// payload's new value.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PayloadTargetsAnExistingKey_RemovesAndReplacesIt()
    {
        var targetedRow = new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = false
        };
        var (roleCapabilitiesSet, endpoint) = CreateSut([targetedRow]);

        List<RoleCapability>? removedRows = null;
        List<RoleCapability>? addedRows = null;
        roleCapabilitiesSet
            .Setup(x => x.RemoveRange(It.IsAny<IEnumerable<RoleCapability>>()))
            .Callback<IEnumerable<RoleCapability>>(rows => removedRows = rows.ToList());
        roleCapabilitiesSet
            .Setup(x => x.AddRange(It.IsAny<IEnumerable<RoleCapability>>()))
            .Callback<IEnumerable<RoleCapability>>(rows => addedRows = rows.ToList());

        await endpoint.HandleAsync(new SetRoleCapabilitiesDto
        {
            Items = [new RoleCapabilityDto { Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = true }]
        }, CancellationToken.None);

        removedRows.Should().Contain(targetedRow);
        addedRows.Should().ContainSingle(row =>
            row.Role == UserRoleType.Driver && row.CapabilityKey == nameof(Capability.Invoicing) && row.IsVisible);
    }

    /// <summary>
    /// The matched key comparison must be case-insensitive, consistent with
    /// <see cref="RoleCapabilityPolicy"/>'s read side — a row saved with different casing than
    /// the payload's key would otherwise survive as an untouched duplicate instead of being
    /// replaced.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PayloadKeyDiffersOnlyByCase_StillRemovesTheStoredRow()
    {
        var storedRow = new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = false
        };
        var (roleCapabilitiesSet, endpoint) = CreateSut([storedRow]);

        List<RoleCapability>? removedRows = null;
        roleCapabilitiesSet
            .Setup(x => x.RemoveRange(It.IsAny<IEnumerable<RoleCapability>>()))
            .Callback<IEnumerable<RoleCapability>>(rows => removedRows = rows.ToList());

        await endpoint.HandleAsync(new SetRoleCapabilitiesDto
        {
            Items = [new RoleCapabilityDto { Role = UserRoleType.Driver, CapabilityKey = "Invoicing", IsVisible = true }]
        }, CancellationToken.None);

        removedRows.Should().Contain(storedRow);
    }

    /// <summary>
    /// A row for a role the payload never mentions at all must also survive — the removal set
    /// is scoped per (role, key), not per role.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PayloadOmitsARole_DoesNotRemoveThatRolesRow()
    {
        var managerRow = new RoleCapability
        {
            Role = UserRoleType.Manager, CapabilityKey = nameof(Capability.Invoicing), IsVisible = false
        };
        var driverRow = new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = false
        };
        var (roleCapabilitiesSet, endpoint) = CreateSut([managerRow, driverRow]);

        List<RoleCapability>? removedRows = null;
        roleCapabilitiesSet
            .Setup(x => x.RemoveRange(It.IsAny<IEnumerable<RoleCapability>>()))
            .Callback<IEnumerable<RoleCapability>>(rows => removedRows = rows.ToList());

        await endpoint.HandleAsync(new SetRoleCapabilitiesDto
        {
            Items = [new RoleCapabilityDto { Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = true }]
        }, CancellationToken.None);

        removedRows.Should().NotContain(managerRow);
        removedRows.Should().Contain(driverRow);
    }
}
