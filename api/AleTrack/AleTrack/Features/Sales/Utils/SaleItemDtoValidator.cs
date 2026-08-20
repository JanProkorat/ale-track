using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Sales.Utils;

/// <summary>
/// Validates a single sale line as sent by the client.
/// </summary>
/// <remarks>
/// The price is only checked for sign here, not for presence: a draft may legitimately be saved
/// before the price is agreed, and completion is where an unpriced line is refused.
/// </remarks>
public sealed class SaleItemDtoValidator : Validator<SaleItemDto>
{
    /// <summary>
    /// Sets up the rules.
    /// </summary>
    public SaleItemDtoValidator()
    {
        RuleFor(r => r.InventoryItemId).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Quantity).GreaterThan(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);

        RuleFor(r => r.UnitPriceWithVat)
            .GreaterThanOrEqualTo(0m)
            .When(r => r.UnitPriceWithVat.HasValue)
            .WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);

        RuleFor(r => r.Note).MaximumLength(500).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
