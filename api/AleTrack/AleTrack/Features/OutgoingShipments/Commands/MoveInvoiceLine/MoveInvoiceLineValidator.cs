using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.OutgoingShipments.Commands.MoveInvoiceLine;

/// <summary>
/// Validator for <see cref="MoveInvoiceLineRequest"/>.
/// </summary>
public sealed class MoveInvoiceLineValidator : Validator<MoveInvoiceLineRequest>
{
    public MoveInvoiceLineValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new MoveInvoiceLineDtoValidator());
    }
}

/// <summary>
/// Validator for <see cref="MoveInvoiceLineDto"/>.
/// </summary>
public sealed class MoveInvoiceLineDtoValidator : AbstractValidator<MoveInvoiceLineDto>
{
    public MoveInvoiceLineDtoValidator()
    {
        RuleFor(dto => dto.FromInvoiceId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);

        RuleFor(dto => dto.SourceItemId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);

        RuleFor(dto => dto.SourceKind)
            .IsInEnum()
            .WithErrorCode(ErrorCodes.ValidationEnumError);

        RuleFor(dto => dto.Quantity)
            .GreaterThan(0)
            .WithErrorCode(ErrorCodes.ValidationError);

        // Exactly one target: an existing invoice, or a client to open a new one for.
        RuleFor(dto => dto)
            .Must(dto => dto.ToInvoiceId.HasValue ^ dto.ToClientId.HasValue)
            .WithErrorCode(ErrorCodes.ValidationError)
            .WithMessage("Specify either ToInvoiceId or ToClientId, not both and not neither.");
    }
}
