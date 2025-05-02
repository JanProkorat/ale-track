using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Drivers.Commands.Create;

/// <summary>
/// Provides validation logic for the <see cref="CreateDriverRequest"/> object to ensure
/// the data provided in the request adheres to predefined rules.
/// </summary>
public sealed class CreateDriverValidator : Validator<CreateDriverRequest>
{
    public CreateDriverValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateDriverDtoValidator());
    }
}

/// <summary>
/// Provides validation logic for the <see cref="CreateDriverDto"/> object to ensure
/// the data provided in the DTO adheres to predefined business rules, such as non-null and constrained
/// character length requirements for specific fields.
/// </summary>
public sealed class CreateDriverDtoValidator : Validator<CreateDriverDto>
{
    public CreateDriverDtoValidator()
    {
        RuleFor(r => r.FirstName).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.FirstName).MaximumLength(20).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.LastName).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.LastName).MaximumLength(20).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
