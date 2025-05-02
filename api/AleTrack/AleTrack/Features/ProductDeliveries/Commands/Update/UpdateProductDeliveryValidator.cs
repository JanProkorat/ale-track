using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.ProductDeliveries.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.ProductDeliveries.Commands.Update;

/// <summary>
/// Validator for <see cref="UpdateProductDeliveryRequest"/> that enforces business rules and validation logic
/// for updating product delivery data.
/// </summary>
/// <remarks>
/// This validator ensures that the provided request and its nested properties adhere to specific
/// constraints such as mandatory fields and length limits.
/// Rules applied:
/// - Id must not be null.
/// - Data property is validated using <see cref="UpdateProductDeliveryDtoValidator"/>.
/// </remarks>
public sealed class UpdateProductDeliveryValidator : Validator<UpdateProductDeliveryRequest>
{
    public UpdateProductDeliveryValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateProductDeliveryDtoValidator());
    }
}

/// <summary>
/// Validator for <see cref="UpdateProductDeliveryDto"/> that enforces business rules and validation logic
/// for updating product delivery data.
/// </summary>
/// <remarks>
/// This validator ensures that the properties of the <see cref="UpdateProductDeliveryDto"/> adhere to specific
/// constraints such as required fields, maximum allowable lengths, and conditional validations.
/// Rules applied:
/// - State must not be null.
/// - DeliveryDate must not be null.
/// - Note, if provided, must not exceed 200 characters.
/// </remarks>```c#
/// <summary>
/// Validator for <see cref="UpdateProductDeliveryDto"/> that enforces business rules and validation logic
/// for the data transfer object used in updating product delivery details.
/// </summary>
/// <remarks>
/// This validator ensures that the properties within the data transfer object comply with
/// specific business rules and data integrity constraints.
/// Rules applied:
/// - State must not be null.
/// - DeliveryDate must not be null.
/// - Note, if provided, must not exceed a maximum length of 200 characters.
/// </remarks>
public sealed class UpdateProductDeliveryDtoValidator : Validator<UpdateProductDeliveryDto>
{
    public UpdateProductDeliveryDtoValidator()
    {
        RuleFor(r => r.State).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.DeliveryDate).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Note)
            .MaximumLength(200)
            .When(r => r.Note != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(r => r.VehicleId)
            .NotNull()
            .When(r => r.State != ProductDeliveryState.InPlanning)
            .WithErrorCode(ProductDeliveryErrorCodes.VehicleNotSelectedError);
        
        RuleFor(r => r.DriverIds)
            .NotEmpty()
            .When(r => r.State != ProductDeliveryState.InPlanning)
            .WithErrorCode(ProductDeliveryErrorCodes.DriversNotSelectedError);
    }
}
