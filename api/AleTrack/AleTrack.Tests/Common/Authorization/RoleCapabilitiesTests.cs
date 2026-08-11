using AleTrack.Common.Authorization;
using AleTrack.Common.Enums;
using FluentAssertions;

namespace AleTrack.Tests.Common.Authorization;

/// <summary>
/// The role → capability table. Guards the direction of the default: a role absent from
/// the table is denied nothing, so adding a role without touching the table must never
/// silently restrict it.
/// </summary>
public sealed class RoleCapabilitiesTests
{
    [Theory]
    [InlineData(Capability.Invoicing)]
    [InlineData(Capability.LoadingBreakdown)]
    [InlineData(Capability.Money)]
    public void Denies_Driver_IsDeniedEveryRestrictedCapability(Capability capability)
    {
        RoleCapabilities.Denies(UserRoleType.Driver, capability).Should().BeTrue();
    }

    [Theory]
    [InlineData(UserRoleType.Admin)]
    [InlineData(UserRoleType.User)]
    public void Denies_UnrestrictedRoles_AreDeniedNothing(UserRoleType role)
    {
        foreach (var capability in Enum.GetValues<Capability>())
        {
            RoleCapabilities.Denies(role, capability).Should().BeFalse();
        }
    }
}
