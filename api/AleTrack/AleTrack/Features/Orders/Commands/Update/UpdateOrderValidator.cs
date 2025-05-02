using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Orders.Commands.Update;

/// <summary>
/// Validates the properties of the UpdateOrderRequest object to ensure they meet the required criteria.
/// </summary>
/// <remarks>
/// This validator enforces the following rules:
/// - The Data property must not be null. A specific error code is generated if this validation fails.
/// - The Data property must adhere to the validation rules defined by the UpdateOrderDtoValidator.
/// </remarks>
public sealed class UpdateOrderRequestValidator : Validator<UpdateOrderRequest>
{
    public UpdateOrderRequestValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateOrderDtoValidator());
    }
}

/// <summary>
/// Validates the properties of the UpdateOrderDto object to ensure they meet the required criteria.
/// </summary>
/// <remarks>
/// This validator enforces the following rules:
/// - The ClientId must not be null. A specific error code is generated if this validation fails.
/// - The DeliveryDate, if provided, must be greater than the current UTC date and time. A specific error code is generated if this validation fails.
/// - The OrderItems collection, if not empty, requires each item to meet the validation criteria defined by the UpdateOrderItemDtoValidator.
/// </remarks>
public sealed class UpdateOrderDtoValidator : Validator<UpdateOrderDto>
{
    public UpdateOrderDtoValidator()
    {
        
        RuleFor(r => r.DeliveryDate)
            .GreaterThan(DateTime.UtcNow)
            .When(d => d.DeliveryDate != null)
            .WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
    }
}
