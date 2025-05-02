using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Drivers.Commands.Update;

/// <summary>
/// Provides validation logic for the <see cref="UpdateDriverRequest"/> object to ensure
/// the request data adheres to the required business rules, such as non-null checks for both
/// the driver identifier and update data, as well as applying additional validations
/// through the <see cref="UpdateDriverDtoValidator"/>.
/// </summary>
public sealed class UpdateDriverValidator : Validator<UpdateDriverRequest>
{
    public UpdateDriverValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateDriverDtoValidator());
    }
}

/// <summary>
/// Provides validation logic for the <see cref="UpdateDriverDto"/> object to ensure
/// the data provided in the DTO adheres to predefined business rules, such as non-null and constrained
/// character length requirements for specific fields.
/// </summary>
public sealed class UpdateDriverDtoValidator : Validator<UpdateDriverDto>
{
    public UpdateDriverDtoValidator()
    {
        RuleFor(r => r.FirstName).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.FirstName).MaximumLength(20).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.LastName).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.LastName).MaximumLength(20).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
