using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Breweries.Commands.Create;

/// <summary>
/// Provides validation rules for the <see cref="CreateBreweryRequest"/> class,
/// ensuring the validation of nested data structures such as <see cref="AddressDto"/>.
/// </summary>
public sealed class CreateBreweryValidator : Validator<CreateBreweryRequest>
{
    public CreateBreweryValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateBreweryDtoValidator());
    }
}

/// <summary>
/// Defines validation rules for the <see cref="CreateBreweryDto"/> class,
/// ensuring compliance with constraints such as non-null requirements and maximum length for properties.
/// </summary>
public sealed class CreateBreweryDtoValidator : Validator<CreateBreweryDto>
{
    public CreateBreweryDtoValidator()
    {
        RuleFor(r => r.Name).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Name).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.OfficialAddress).SetValidator(new AddressValidator());
        RuleFor(r => r.ContactAddress).SetValidator(new AddressValidator()).When(r => r.ContactAddress != null);
    }
}