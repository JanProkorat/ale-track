using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.OutgoingShipments.Commands.SetInvoiceBillingRecipients;

/// <summary>
/// Validator for <see cref="SetInvoiceBillingRecipientsRequest"/>.
/// </summary>
public sealed class SetInvoiceBillingRecipientsValidator : Validator<SetInvoiceBillingRecipientsRequest>
{
    public SetInvoiceBillingRecipientsValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.InvoiceId).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new SetInvoiceBillingRecipientsDtoValidator());
    }
}

/// <summary>
/// Validator for <see cref="SetInvoiceBillingRecipientsDto"/>.
/// </summary>
public sealed class SetInvoiceBillingRecipientsDtoValidator : AbstractValidator<SetInvoiceBillingRecipientsDto>
{
    public SetInvoiceBillingRecipientsDtoValidator()
    {
        RuleForEach(dto => dto.ClientIds)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);

        RuleFor(dto => dto.ClientIds)
            .Must(ids => ids.Distinct().Count() == ids.Count)
            .WithErrorCode(ErrorCodes.ValidationError)
            .WithMessage("A client can be named only once.");
    }
}
