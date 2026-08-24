using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Clients.Commands.Ledger.Update;

/// <summary>
/// Validator for <see cref="UpdateClientLedgerEntryRequest"/>.
/// </summary>
public sealed class UpdateClientLedgerEntryValidator : Validator<UpdateClientLedgerEntryRequest>
{
    public UpdateClientLedgerEntryValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);

        RuleFor(r => r.Data.PlannedQuantity)
            .GreaterThanOrEqualTo(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError)
            .When(r => r.Data.PlannedQuantity is not null);

        RuleFor(r => r.Data.ActualQuantity)
            .GreaterThanOrEqualTo(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError)
            .When(r => r.Data.ActualQuantity is not null);

        RuleFor(r => r.Data.LineName).MaximumLength(200).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.Data.Note).MaximumLength(1000).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
