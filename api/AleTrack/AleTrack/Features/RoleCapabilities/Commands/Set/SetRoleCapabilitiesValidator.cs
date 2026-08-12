using AleTrack.Common.Enums;
using AleTrack.Features.RoleCapabilities.Errors;
using AleTrack.Features.RoleCapabilities.Shared;
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

            // WithErrorCode binds only to the immediately preceding validator, not the whole
            // chain, so it must be repeated after every validator that should carry this code.
            item.RuleFor(x => x.CapabilityKey)
                .NotEmpty()
                .WithErrorCode(RoleCapabilityErrorCodes.CapabilityKeyInvalid)
                .MaximumLength(64)
                .WithErrorCode(RoleCapabilityErrorCodes.CapabilityKeyInvalid);
        });

        // An omitted items field is safe (SetRoleCapabilitiesDto.Items initializes to an empty
        // list), but an explicit "items": null binds a null reference here — without NotNull,
        // HaveNoDuplicateKeyPerRole throws calling GroupBy on it, turning a malformed request
        // into a 500 instead of the intended 400.
        //
        // The read side (RoleCapabilityPolicy) folds hidden keys case-insensitively per role, so
        // two rows differing only by key casing for the same role would insert as distinct DB
        // rows (the unique index is case-sensitive) while being indistinguishable on read - which
        // one "wins" would then depend on undefined row order and could flip across the cache's
        // 2-minute expiry. Reject that combination here instead of allowing it into the table.
        // Cascade(Stop) is required here: FluentValidation's default per-rule cascade mode
        // keeps running every validator in the chain even after an earlier one fails, so
        // without it Must still runs — and throws — on a null Items even though NotNull
        // already failed.
        RuleFor(dto => dto.Items)
            .Cascade(CascadeMode.Stop)
            .NotNull()
            .WithErrorCode(RoleCapabilityErrorCodes.ItemsRequired)
            .Must(HaveNoDuplicateKeyPerRole)
            .WithErrorCode(RoleCapabilityErrorCodes.DuplicateCapabilityKey);
    }

    private static bool HaveNoDuplicateKeyPerRole(List<RoleCapabilityDto> items) =>
        items
            .GroupBy(item => item.Role)
            .All(group => group
                .Select(item => item.CapabilityKey)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count() == group.Count());
}
