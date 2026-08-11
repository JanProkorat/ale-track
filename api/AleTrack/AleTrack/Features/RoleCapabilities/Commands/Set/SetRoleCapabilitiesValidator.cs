using AleTrack.Common.Enums;
using AleTrack.Features.RoleCapabilities.Errors;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.RoleCapabilities.Commands.Set;

/// <summary>
/// Validates a full replacement of the role capability table.
/// </summary>
internal sealed class SetRoleCapabilitiesValidator : Validator<SetRoleCapabilitiesDto>
{
    public SetRoleCapabilitiesValidator()
    {
        RuleForEach(dto => dto.Items).ChildRules(item =>
        {
            item.RuleFor(x => x.Role)
                .NotEqual(UserRoleType.Admin)
                .WithErrorCode(RoleCapabilityErrorCodes.AdminIsNotConfigurable);

            item.RuleFor(x => x.CapabilityKey)
                .NotEmpty()
                .MaximumLength(64)
                .WithErrorCode(RoleCapabilityErrorCodes.CapabilityKeyInvalid);
        });
    }
}
