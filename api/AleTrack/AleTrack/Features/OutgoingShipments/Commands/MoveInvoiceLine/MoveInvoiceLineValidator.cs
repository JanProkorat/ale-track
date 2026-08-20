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
        // Null means "off the private pieces"; an explicitly empty Guid is a caller mistake.
        // NotEmpty() cannot express that on a Guid? — it only rejects null.
        RuleFor(dto => dto.FromInvoiceId)
            .Must(id => id != Guid.Empty)
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError)
            .When(dto => dto.FromInvoiceId.HasValue);

        RuleFor(dto => dto.SourceItemId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);

        RuleFor(dto => dto.SourceKind)
            .IsInEnum()
            .WithErrorCode(ErrorCodes.ValidationEnumError);

        RuleFor(dto => dto.Quantity)
            .GreaterThan(0)
            .WithErrorCode(ErrorCodes.ValidationError);

        // Exactly one target: an existing invoice, a client to open a new one for, or no invoice
        // at all.
        RuleFor(dto => dto)
            .Must(dto => new[] { dto.ToInvoiceId.HasValue, dto.ToClientId.HasValue, dto.ToPrivate }.Count(x => x) == 1)
            .WithErrorCode(ErrorCodes.ValidationError)
            .WithMessage("Specify exactly one of ToInvoiceId, ToClientId or ToPrivate.");
    }
}
