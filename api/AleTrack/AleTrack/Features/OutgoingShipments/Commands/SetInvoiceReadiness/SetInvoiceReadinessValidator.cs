using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.OutgoingShipments.Commands.SetInvoiceReadiness;

/// <summary>
/// Validator for <see cref="SetInvoiceReadinessRequest"/>.
/// </summary>
public sealed class SetInvoiceReadinessValidator : Validator<SetInvoiceReadinessRequest>
{
    public SetInvoiceReadinessValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.ClientId).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
    }
}
