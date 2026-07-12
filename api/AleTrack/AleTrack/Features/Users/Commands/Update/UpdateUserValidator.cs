using AleTrack.Common.Utils;
using AleTrack.Features.Users.Commands.Update;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Users.Commands.Update;

/// <summary>
/// Validator for the <see cref="UpdateUserRequest"/> object. Ensures that the data required for
/// creating a user adheres to the specified validation rules.
/// </summary>
public sealed class UpdateUserValidator : Validator<UpdateUserRequest>
{
    public UpdateUserValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateUserDtoValidator());
    }
}

/// <summary>
/// Validator for the <see cref="UpdateUserDto"/> object. Ensures that the properties of the
/// data transfer object meet the defined validation rules for user creation.
/// </summary>
public sealed class UpdateUserDtoValidator : AbstractValidator<UpdateUserDto>
{
    public UpdateUserDtoValidator()
    {
        RuleFor(dto => dto.FirstName)
            .MaximumLength(50)
            .When(dto => dto.FirstName != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(dto => dto.LastName)
            .MaximumLength(50)
            .When(dto => dto.LastName != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(dto => dto.UserRoles).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
    }
}