using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Clients.Commands.Ledger.Save;

/// <summary>
/// Validator for <see cref="SaveClientLedgerEntriesRequest"/>.
/// </summary>
public sealed class SaveClientLedgerEntriesValidator : Validator<SaveClientLedgerEntriesRequest>
{
    public SaveClientLedgerEntriesValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleForEach(r => r.Data.Rows).SetValidator(new ClientLedgerRowDtoValidator());
    }
}

/// <summary>
/// Validator for one posted deviation.
/// </summary>
/// <remarks>
/// The per-target rules exist because a row that carries neither a quantity pair, an address pair
/// nor an amount says nothing at all — and would be stored as an entry nobody can read.
/// </remarks>
public sealed class ClientLedgerRowDtoValidator : Validator<ClientLedgerRowDto>
{
    private static readonly ClientLedgerEntryTarget[] QuantityTargets =
    [
        ClientLedgerEntryTarget.ProductQuantity,
        ClientLedgerEntryTarget.SupplierGoodQuantity,
        ClientLedgerEntryTarget.CustomExtraQuantity,
        ClientLedgerEntryTarget.ReturnQuantity
    ];

    public ClientLedgerRowDtoValidator()
    {
        RuleFor(r => r.Target).IsInEnum().WithErrorCode(ErrorCodes.ValidationEnumError);

        RuleFor(r => r.PlannedQuantity)
            .NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError)
            .GreaterThanOrEqualTo(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError)
            .When(r => QuantityTargets.Contains(r.Target));

        RuleFor(r => r.ActualQuantity)
            .NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError)
            .GreaterThanOrEqualTo(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError)
            .When(r => QuantityTargets.Contains(r.Target));

        RuleFor(r => r.ActualText)
            .NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError)
            .MaximumLength(500).WithErrorCode(ErrorCodes.ValidationMaxLengthError)
            .When(r => r.Target == ClientLedgerEntryTarget.DeliveryAddress);

        RuleFor(r => r.Amount)
            .NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError)
            .When(r => r.Target == ClientLedgerEntryTarget.Money);

        // Something has to name what the row is about, or the reader is left with a quantity and
        // no idea what of.
        RuleFor(r => r.LineName)
            .NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError)
            .When(r => r.Target is ClientLedgerEntryTarget.ReturnQuantity or ClientLedgerEntryTarget.CustomExtraQuantity
                       && r.OrderReturnId is null
                       && r.CustomExtraItemId is null);

        RuleFor(r => r.LineName).MaximumLength(200).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.Note).MaximumLength(1000).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.PlannedText).MaximumLength(500).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
