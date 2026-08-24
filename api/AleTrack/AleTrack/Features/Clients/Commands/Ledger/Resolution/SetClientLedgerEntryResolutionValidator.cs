using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Clients.Commands.Ledger.Resolution;

/// <summary>
/// Validator for <see cref="SetClientLedgerEntryResolutionRequest"/>.
/// </summary>
public sealed class SetClientLedgerEntryResolutionValidator : Validator<SetClientLedgerEntryResolutionRequest>
{
    public SetClientLedgerEntryResolutionValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data.Note).MaximumLength(1000).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
