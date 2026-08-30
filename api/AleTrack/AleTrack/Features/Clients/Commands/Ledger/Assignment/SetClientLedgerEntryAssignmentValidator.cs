using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Clients.Commands.Ledger.Assignment;

/// <summary>
/// Validator for <see cref="SetClientLedgerEntryAssignmentRequest"/>.
/// </summary>
/// <remarks>
/// The order id is deliberately not required: null is the release, which is half of what this
/// endpoint is for.
/// </remarks>
public sealed class SetClientLedgerEntryAssignmentValidator : Validator<SetClientLedgerEntryAssignmentRequest>
{
    public SetClientLedgerEntryAssignmentValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
    }
}
