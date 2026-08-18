using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Suppliers.Commands.Create;

/// <summary>
/// Validation rules for <see cref="CreateSupplierRequest"/>.
/// </summary>
public sealed class CreateSupplierValidator : Validator<CreateSupplierRequest>
{
    public CreateSupplierValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateSupplierDtoValidator());
    }
}

/// <summary>
/// Validation rules for <see cref="CreateSupplierDto"/>.
/// </summary>
public sealed class CreateSupplierDtoValidator : Validator<CreateSupplierDto>
{
    public CreateSupplierDtoValidator()
    {
        RuleFor(r => r.Name).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Name).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.BusinessName).MaximumLength(50).When(x => x.BusinessName != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.Note).MaximumLength(500).When(x => x.Note != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.OfficialAddress).SetValidator(new AddressValidator());
        RuleFor(r => r.ContactAddress).SetValidator(new AddressValidator()!).When(r => r.ContactAddress != null);
        RuleFor(r => r.Contacts)
            .ForEach(contact => contact.SetValidator(new SupplierContactUpsertDtoValidator()));
    }
}

/// <summary>
/// Validation rules for a contact arriving on a create or update — same rules as a client
/// contact, since the two carry the same fields.
/// </summary>
public sealed class SupplierContactUpsertDtoValidator : Validator<SupplierContactUpsertDto>
{
    public SupplierContactUpsertDtoValidator()
    {
        RuleFor(r => r.Type).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Description).MaximumLength(50).When(x => x.Description != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.Value).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Value).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
