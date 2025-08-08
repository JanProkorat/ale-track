using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Users.Commands.Create;

/// <summary>
/// Validator for the <see cref="CreateUserRequest"/> object. Ensures that the data required for
/// creating a user adheres to the specified validation rules.
/// </summary>
public sealed class CreateUserValidator : Validator<CreateUserRequest>
{
    public CreateUserValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateUserDtoValidator());
    }
}

/// <summary>
/// Validator for the <see cref="CreateUserDto"/> object. Ensures that the properties of the
/// data transfer object meet the defined validation rules for user creation.
/// </summary>
public sealed class CreateUserDtoValidator : AbstractValidator<CreateUserDto>
{
    public CreateUserDtoValidator()
    {
        RuleFor(dto => dto.FirstName)
            .MaximumLength(50)
            .When(dto => dto.FirstName != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(dto => dto.LastName)
            .MaximumLength(50)
            .When(dto => dto.LastName != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(dto => dto.UserName).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(dto => dto.UserName).MaximumLength(20).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(dto => dto.Password).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(dto => dto.Password).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(dto => dto.UserRoles).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
    }
}