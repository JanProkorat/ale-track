using System.Security.Claims;
using AleTrack.Common.Authorization;
using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using Moq.EntityFrameworkCore;

namespace AleTrack.Tests.Common.Authorization;

/// <summary>
/// The capability gate that keeps invoicing data away from a driver. The module permission
/// matrix decides whether a caller reaches a shipment endpoint at all; these tests cover
/// the second gate that decides whether the restricted part of it is theirs to see.
/// </summary>
public sealed class CapabilityHandlerTests
{
    private static async Task<bool> SucceedsAsync(
        Capability capability,
        RoleCapability[] rows,
        params UserRoleType[] roles)
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            roles.Select(r => new Claim(ClaimTypes.Role, r.ToString())),
            authenticationType: "Test",
            nameType: ClaimTypes.Name,
            roleType: ClaimTypes.Role));

        var dbContext = new Mock<AleTrackDbContext>(new DbContextOptions<AleTrackDbContext>());
        dbContext.Setup(x => x.RoleCapabilities).ReturnsDbSet(rows);
        var policy = new RoleCapabilityPolicy(dbContext.Object, new MemoryCache(new MemoryCacheOptions()));

        var requirement = new CapabilityRequirement(capability);
        var context = new AuthorizationHandlerContext([requirement], principal, resource: null);

        await new CapabilityHandler(policy).HandleAsync(context);

        return context.HasSucceeded;
    }

    private static RoleCapability[] DriverDeniedInvoicing() =>
    [
        new() { Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = false }
    ];

    private static RoleCapability[] DriverDeniedEveryCapability() =>
        Enum.GetValues<Capability>()
            .Select(capability => new RoleCapability
            {
                Role = UserRoleType.Driver, CapabilityKey = capability.ToString(), IsVisible = false
            })
            .ToArray();

    [Theory]
    [InlineData(Capability.Invoicing)]
    [InlineData(Capability.LoadingBreakdown)]
    [InlineData(Capability.Money)]
    public async Task HandleAsync_CallerIsAdmin_SucceedsForEveryCapability(Capability capability)
    {
        (await SucceedsAsync(capability, DriverDeniedEveryCapability(), UserRoleType.Admin)).Should().BeTrue();
    }

    [Theory]
    [InlineData(Capability.Invoicing)]
    [InlineData(Capability.LoadingBreakdown)]
    [InlineData(Capability.Money)]
    public async Task HandleAsync_CallerIsPlainUser_SucceedsForEveryCapability(Capability capability)
    {
        (await SucceedsAsync(capability, DriverDeniedEveryCapability(), UserRoleType.Manager)).Should().BeTrue();
    }

    [Theory]
    [InlineData(Capability.Invoicing)]
    [InlineData(Capability.LoadingBreakdown)]
    [InlineData(Capability.Money)]
    public async Task HandleAsync_CallerIsDriver_FailsForEveryDeniedCapability(Capability capability)
    {
        (await SucceedsAsync(capability, DriverDeniedEveryCapability(), UserRoleType.Driver)).Should().BeFalse();
    }

    /// <summary>
    /// Nothing on the backend enforces one role per account, so the rule is
    /// deny-if-any-denies rather than "read the first role".
    /// </summary>
    [Fact]
    public async Task HandleAsync_CallerIsDriverAndUser_DenialWins()
    {
        (await SucceedsAsync(Capability.Invoicing, DriverDeniedInvoicing(), UserRoleType.Driver, UserRoleType.Manager))
            .Should().BeFalse();

        (await SucceedsAsync(Capability.Invoicing, DriverDeniedInvoicing(), UserRoleType.Manager, UserRoleType.Driver))
            .Should().BeFalse();
    }

    /// <summary>
    /// Admin is a deliberate short-circuit: it wins even over a denying role, matching the
    /// module matrix where Admin bypasses permissions entirely.
    /// </summary>
    [Fact]
    public async Task HandleAsync_CallerIsDriverAndAdmin_AdminShortCircuitWins()
    {
        (await SucceedsAsync(Capability.Invoicing, DriverDeniedInvoicing(), UserRoleType.Driver, UserRoleType.Admin))
            .Should().BeTrue();
    }

    /// <summary>
    /// The handler itself does not authenticate — the registered policy adds
    /// <c>RequireAuthenticatedUser()</c> (see <c>AuthenticationExtensions.AddUserAuthorization</c>),
    /// which is what rejects an anonymous caller. Pinned so nobody drops that call believing
    /// the handler covers it.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NoRoles_SucceedsBecauseAuthenticationIsThePolicysJob()
    {
        (await SucceedsAsync(Capability.Invoicing, DriverDeniedInvoicing())).Should().BeTrue();
    }

    /// <summary>
    /// The point of moving policy into the database: a row flipped to visible lets the role
    /// through without a deploy.
    /// </summary>
    [Fact]
    public async Task HandleAsync_DriverRowFlippedToVisible_Succeeds()
    {
        RoleCapability[] rows =
        [
            new() { Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = true }
        ];

        (await SucceedsAsync(Capability.Invoicing, rows, UserRoleType.Driver)).Should().BeTrue();
    }
}
