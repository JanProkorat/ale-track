using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// Validates a single note on an order.
/// </summary>
/// <remarks>
/// This validator enforces the following rules:
/// - The Text must not be empty and must not exceed 1000 characters
///   (the limit on <see cref="Entities.Note"/>).
/// </remarks>
public sealed class OrderNoteDtoValidator : Validator<OrderNoteDto>
{
    public OrderNoteDtoValidator()
    {
        RuleFor(n => n.Text).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(n => n.Text).MaximumLength(1000).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
