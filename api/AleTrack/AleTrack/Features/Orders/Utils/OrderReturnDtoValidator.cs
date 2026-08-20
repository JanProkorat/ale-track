using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// Validates a single returnable item on an order.
/// </summary>
/// <remarks>
/// This validator enforces the following rules:
/// - The Name must not be empty and must not exceed 200 characters.
/// - The Quantity must be greater than 0.
/// - The Note, if provided, must not exceed 500 characters.
/// </remarks>
public sealed class OrderReturnDtoValidator : Validator<OrderReturnDto>
{
    public OrderReturnDtoValidator()
    {
        RuleFor(r => r.Name).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Name).MaximumLength(200).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.Quantity).GreaterThan(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
        RuleFor(r => r.Note)
            .MaximumLength(500)
            .When(r => r.Note != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
