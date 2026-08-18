using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Features.Suppliers.Commands.Create;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Suppliers.Commands.Update;

/// <summary>
/// Validation rules for <see cref="UpdateSupplierRequest"/>.
/// </summary>
public sealed class UpdateSupplierValidator : Validator<UpdateSupplierRequest>
{
    public UpdateSupplierValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateSupplierDtoValidator());
    }
}

/// <summary>
/// Validation rules for <see cref="UpdateSupplierDto"/> — the same field rules as on create.
/// </summary>
public sealed class UpdateSupplierDtoValidator : Validator<UpdateSupplierDto>
{
    public UpdateSupplierDtoValidator()
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
