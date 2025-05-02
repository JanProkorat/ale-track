using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Common.Models;

/// <summary>
/// Provides validation rules for the <see cref="AddressDto"/> class.
/// </summary>
public sealed class AddressValidator : Validator<AddressDto>
{
    public AddressValidator()
    {
        RuleFor(r => r.StreetName).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.StreetName).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(r => r.StreetNumber).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.StreetNumber).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);

        RuleFor(r => r.City).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.City).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);

        RuleFor(r => r.Zip).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Zip).MaximumLength(10).WithErrorCode(ErrorCodes.ValidationMaxLengthError);

        RuleFor(r => r.Country).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Country).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}