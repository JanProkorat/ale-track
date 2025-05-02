using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Users.Commands.Login;

/// <summary>
/// Validator for the <see cref="LoginRequest"/> object, ensuring that the request
/// data adheres to required validation rules.
/// </summary>
public sealed class LoginValidator : Validator<LoginRequest>
{
    public LoginValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new LoginUserDtoValidator());
    }
}

/// <summary>
/// Validator for the <see cref="LoginUserDto"/> object, ensuring that the user data
/// such as username and password meet the required validation rules.
/// </summary>
public sealed class LoginUserDtoValidator : AbstractValidator<LoginUserDto>
{
    public LoginUserDtoValidator()
    {
        RuleFor(dto => dto.UserName).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(dto => dto.UserName).MaximumLength(20).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(dto => dto.Password).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(dto => dto.Password).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}