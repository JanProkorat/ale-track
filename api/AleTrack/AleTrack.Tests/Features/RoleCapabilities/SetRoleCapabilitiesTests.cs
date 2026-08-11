using AleTrack.Common.Enums;
using AleTrack.Features.RoleCapabilities.Commands.Set;
using AleTrack.Features.RoleCapabilities.Errors;
using AleTrack.Features.RoleCapabilities.Shared;
using FluentValidation.TestHelper;

namespace AleTrack.Tests.Features.RoleCapabilities;

/// <summary>
/// Admin bypasses capabilities in the handler, so a stored Admin row could only ever be a lie.
/// The validator refuses them rather than letting a client bug write one.
/// </summary>
public sealed class SetRoleCapabilitiesTests
{
    [Fact]
    public void Validate_RowForAdmin_FailsWithCorrectCode()
    {
        var result = new SetRoleCapabilitiesValidator().TestValidate(new SetRoleCapabilitiesDto
        {
            Items = [new RoleCapabilityDto { Role = UserRoleType.Admin, CapabilityKey = "invoicing", IsVisible = false }]
        });

        result.ShouldHaveValidationErrorFor("Items[0].Role")
            .WithErrorCode(RoleCapabilityErrorCodes.AdminIsNotConfigurable);
    }

    [Fact]
    public void Validate_EmptyKey_Fails()
    {
        var result = new SetRoleCapabilitiesValidator().TestValidate(new SetRoleCapabilitiesDto
        {
            Items = [new RoleCapabilityDto { Role = UserRoleType.Driver, CapabilityKey = "", IsVisible = false }]
        });

        result.ShouldHaveValidationErrorFor("Items[0].CapabilityKey")
            .WithErrorCode(RoleCapabilityErrorCodes.CapabilityKeyInvalid);
    }

    [Fact]
    public void Validate_DriverRow_Passes()
    {
        var result = new SetRoleCapabilitiesValidator().TestValidate(new SetRoleCapabilitiesDto
        {
            Items = [new RoleCapabilityDto { Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = false }]
        });

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_SameRoleAndKeyTwice_FailsWithCorrectCode()
    {
        var result = new SetRoleCapabilitiesValidator().TestValidate(new SetRoleCapabilitiesDto
        {
            Items =
            [
                new RoleCapabilityDto { Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = false },
                new RoleCapabilityDto { Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = true }
            ]
        });

        result.ShouldHaveValidationErrorFor("Items")
            .WithErrorCode(RoleCapabilityErrorCodes.DuplicateCapabilityKey);
    }

    [Fact]
    public void Validate_SameRoleAndKeyDifferentCaseTwice_FailsWithCorrectCode()
    {
        // The read side (RoleCapabilityPolicy) folds keys case-insensitively, so "invoicing" and
        // "Invoicing" for the same role must be treated as the same duplicate, not two rows the
        // case-sensitive DB unique index would happily accept.
        var result = new SetRoleCapabilitiesValidator().TestValidate(new SetRoleCapabilitiesDto
        {
            Items =
            [
                new RoleCapabilityDto { Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = false },
                new RoleCapabilityDto { Role = UserRoleType.Driver, CapabilityKey = "Invoicing", IsVisible = true }
            ]
        });

        result.ShouldHaveValidationErrorFor("Items")
            .WithErrorCode(RoleCapabilityErrorCodes.DuplicateCapabilityKey);
    }

    [Fact]
    public void Validate_SameKeyDifferentRoles_Passes()
    {
        // The duplicate check is scoped per role: the same key may legitimately be configured
        // differently for two different roles in the same payload.
        var result = new SetRoleCapabilitiesValidator().TestValidate(new SetRoleCapabilitiesDto
        {
            Items =
            [
                new RoleCapabilityDto { Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = false },
                new RoleCapabilityDto { Role = UserRoleType.Manager, CapabilityKey = "invoicing", IsVisible = true }
            ]
        });

        result.ShouldNotHaveAnyValidationErrors();
    }
}
