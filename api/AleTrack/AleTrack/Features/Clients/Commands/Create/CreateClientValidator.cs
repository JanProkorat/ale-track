using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Clients.Commands.Create;

/// <summary>
/// Provides validation rules for the <see cref="CreateClientRequest"/> class,
/// ensuring the validation of nested data structures such as <see cref="AddressDto"/>.
/// </summary>
public sealed class CreateClientValidator : Validator<CreateClientRequest>
{
    public CreateClientValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateClientDtoValidator());
    }
}

/// <summary>
/// Defines validation rules for the <see cref="CreateClientDto"/> class,
/// ensuring compliance with constraints such as non-null requirements and maximum length for properties.
/// </summary>
public sealed class CreateClientDtoValidator : Validator<CreateClientDto>
{
    public CreateClientDtoValidator()
    {
        RuleFor(r => r.Name).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Name).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.BusinessName).MaximumLength(50).When(x => x.BusinessName != null).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.Region).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.OfficialAddress).SetValidator(new AddressValidator());
        RuleFor(r => r.ContactAddress).SetValidator(new AddressValidator()).When(r => r.ContactAddress != null);
        RuleFor(r => r.Contacts)
            .ForEach(contact =>
            {
                contact.SetValidator(new CreateClientContactDtoValidator());
            });
    }
}

public sealed class CreateClientContactDtoValidator : Validator<CreateClientContactDto>
{
    public CreateClientContactDtoValidator()
    {
        RuleFor(r => r.Type).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Description).MaximumLength(50).When(x => x.Description != null).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.Value).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.Value).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
    }
}
