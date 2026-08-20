using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.Sales.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Sales.Commands.Update;

/// <summary>
/// Validates the request to change a draft garage sale.
/// </summary>
public sealed class UpdateSaleValidator : Validator<UpdateSaleRequest>
{
    /// <summary>
    /// Sets up the rules.
    /// </summary>
    public UpdateSaleValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateSaleDtoValidator());
    }
}

/// <summary>
/// Validates the body of an update-sale request.
/// </summary>
/// <remarks>
/// Deliberately a sibling of <see cref="Create.CreateSaleDtoValidator"/> rather than a shared base:
/// the repo already keeps create and update validators separate per feature, and folding them
/// together would cost the per-property error paths the frontend maps its field errors from.
/// </remarks>
public sealed class UpdateSaleDtoValidator : Validator<UpdateSaleDto>
{
    /// <summary>
    /// Sets up the rules.
    /// </summary>
    public UpdateSaleDtoValidator()
    {
        RuleFor(r => r.SaleDate).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.BuyerKind).IsInEnum().WithErrorCode(ErrorCodes.ValidationEnumError);
        RuleFor(r => r.Payment).IsInEnum().WithErrorCode(ErrorCodes.ValidationEnumError);

        RuleFor(r => r.Items).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleForEach(r => r.Items).SetValidator(new SaleItemDtoValidator());

        RuleFor(r => r.BuyerName).MaximumLength(100).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.Note).MaximumLength(500).WithErrorCode(ErrorCodes.ValidationMaxLengthError);

        RuleFor(r => r.ClientId)
            .NotNull()
            .When(r => r.BuyerKind == SaleBuyerKind.Client)
            .WithErrorCode(ErrorCodes.SaleBuyerFieldsMismatch);

        RuleFor(r => r.ClientId)
            .Null()
            .When(r => r.BuyerKind == SaleBuyerKind.Walkin)
            .WithErrorCode(ErrorCodes.SaleBuyerFieldsMismatch);

        RuleFor(r => r.BuyerName)
            .Empty()
            .When(r => r.BuyerKind == SaleBuyerKind.Client)
            .WithErrorCode(ErrorCodes.SaleBuyerFieldsMismatch);

        RuleFor(r => r.Billing)
            .NotNull()
            .When(r => r.Payment == SalePaymentMethod.Invoice)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);

        RuleFor(r => r.Billing!.Name)
            .NotEmpty()
            .When(r => r.Payment == SalePaymentMethod.Invoice && r.Billing is not null)
            .WithErrorCode(ErrorCodes.SaleBillingNameRequired);
        RuleFor(r => r.Billing!.DueDate)
            .NotNull()
            .When(r => r.Payment == SalePaymentMethod.Invoice && r.Billing is not null)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
    }
}
