using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.Sales.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Sales.Commands.Create;

/// <summary>
/// Validates the request to record a new garage sale.
/// </summary>
public sealed class CreateSaleValidator : Validator<CreateSaleRequest>
{
    /// <summary>
    /// Sets up the rules.
    /// </summary>
    public CreateSaleValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateSaleDtoValidator());
    }
}

/// <summary>
/// Validates the body of a create-sale request.
/// </summary>
/// <remarks>
/// Input shape only. Whether the referenced client and stock rows exist is domain state and is
/// checked by the endpoint.
/// </remarks>
public sealed class CreateSaleDtoValidator : Validator<CreateSaleDto>
{
    /// <summary>
    /// Sets up the rules.
    /// </summary>
    public CreateSaleDtoValidator()
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
