using System.Security.Claims;
using AleTrack.Common.Authorization;
using AleTrack.Common.Enums;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;

namespace AleTrack.Tests.Common.Authorization;

/// <summary>
/// The capability gate that keeps invoicing data away from a driver. The module permission
/// matrix decides whether a caller reaches a shipment endpoint at all; these tests cover
/// the second gate that decides whether the restricted part of it is theirs to see.
/// </summary>
public sealed class CapabilityHandlerTests
{
    private static async Task<bool> SucceedsAsync(Capability capability, params UserRoleType[] roles)
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            roles.Select(r => new Claim(ClaimTypes.Role, r.ToString())),
            authenticationType: "Test",
            nameType: ClaimTypes.Name,
            roleType: ClaimTypes.Role));

        var requirement = new CapabilityRequirement(capability);
        var context = new AuthorizationHandlerContext([requirement], principal, resource: null);

        await new CapabilityHandler().HandleAsync(context);

        return context.HasSucceeded;
    }

    [Theory]
    [InlineData(Capability.Invoicing)]
    [InlineData(Capability.LoadingBreakdown)]
    [InlineData(Capability.Money)]
    public async Task HandleAsync_CallerIsAdmin_SucceedsForEveryCapability(Capability capability)
    {
        (await SucceedsAsync(capability, UserRoleType.Admin)).Should().BeTrue();
    }

    [Theory]
    [InlineData(Capability.Invoicing)]
    [InlineData(Capability.LoadingBreakdown)]
    [InlineData(Capability.Money)]
    public async Task HandleAsync_CallerIsPlainUser_SucceedsForEveryCapability(Capability capability)
    {
        (await SucceedsAsync(capability, UserRoleType.User)).Should().BeTrue();
    }

    [Theory]
    [InlineData(Capability.Invoicing)]
    [InlineData(Capability.LoadingBreakdown)]
    [InlineData(Capability.Money)]
    public async Task HandleAsync_CallerIsDriver_FailsForEveryDeniedCapability(Capability capability)
    {
        (await SucceedsAsync(capability, UserRoleType.Driver)).Should().BeFalse();
    }

    /// <summary>
    /// Nothing on the backend enforces one role per account, so the rule is
    /// deny-if-any-denies rather than "read the first role".
    /// </summary>
    [Fact]
    public async Task HandleAsync_CallerIsDriverAndUser_DenialWins()
    {
        (await SucceedsAsync(Capability.Invoicing, UserRoleType.Driver, UserRoleType.User))
            .Should().BeFalse();

        (await SucceedsAsync(Capability.Invoicing, UserRoleType.User, UserRoleType.Driver))
            .Should().BeFalse();
    }

    /// <summary>
    /// Admin is a deliberate short-circuit: it wins even over a denying role, matching the
    /// module matrix where Admin bypasses permissions entirely.
    /// </summary>
    [Fact]
    public async Task HandleAsync_CallerIsDriverAndAdmin_AdminShortCircuitWins()
    {
        (await SucceedsAsync(Capability.Invoicing, UserRoleType.Driver, UserRoleType.Admin))
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
        (await SucceedsAsync(Capability.Invoicing)).Should().BeTrue();
    }
}
