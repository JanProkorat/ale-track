using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Clients.Commands.Update;

/// <summary>
/// Provides validation rules for the <see cref="UpdateClientRequest"/> class,
/// ensuring the validation of nested data structures such as <see cref="AddressDto"/>.
/// </summary>
public sealed class UpdateClientValidator : Validator<UpdateClientRequest>
{
    public UpdateClientValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateClientDtoValidator());
    }
}

/// <summary>
/// Defines validation rules for the <see cref="UpdateClientDto"/> class,
/// ensuring compliance with constraints such as non-null requirements and maximum length for properties.
/// </summary>
public sealed class UpdateClientDtoValidator : Validator<UpdateClientDto>
{
    public UpdateClientDtoValidator()
    {
        RuleFor(r => r.Name).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Name).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.OfficialAddress).SetValidator(new AddressValidator());
        RuleFor(r => r.ContactAddress).SetValidator(new AddressValidator()).When(r => r.ContactAddress != null);
    }
}