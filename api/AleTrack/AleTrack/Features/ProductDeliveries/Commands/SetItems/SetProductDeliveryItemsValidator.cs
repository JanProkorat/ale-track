using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.ProductDeliveries.Commands.SetItems;

/// <summary>
/// Validator for the <see cref="SetProductDeliveryItemsRequest"/>.
/// </summary>
/// <remarks>
/// This class validates the request for setting product delivery items. It ensures that the required properties and nested objects
/// within the request comply with the specified rules.
/// </remarks>
public sealed class SetProductDeliveryItemsValidator : Validator<SetProductDeliveryItemsRequest>
{
    public SetProductDeliveryItemsValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new SetProductDeliveryItemsDtoValidator());
    }
}

/// <summary>
/// Validator for the <see cref="SetProductDeliveryItemsDto"/>.
/// </summary>
/// <remarks>
/// This class is responsible for validating the data transfer object used for setting product delivery items.
/// It enforces the rules for the nested collection properties within the DTO.
/// </remarks>
public sealed class SetProductDeliveryItemsDtoValidator : Validator<SetProductDeliveryItemsDto>
{
    public SetProductDeliveryItemsDtoValidator()
    {
        RuleFor(r => r.Items)
            .ForEach(r => r.SetValidator(new ProductDeliveryItemsDtoValidator()))
            .When(r => r.Items.Count > 0);
    }
}

/// <summary>
/// Validator for the <see cref="ProductDeliveryItemsDto"/>.
/// </summary>
/// <remarks>
/// This class is responsible for validating individual product delivery item entries.
/// It ensures that required fields are not null, quantity values meet the minimum requirements,
/// and optional properties, such as notes, adhere to specified constraints like maximum length.
/// </remarks>
public sealed class ProductDeliveryItemsDtoValidator : Validator<ProductDeliveryItemsDto>
{
    public ProductDeliveryItemsDtoValidator()
    {
        RuleFor(r => r.ProductId).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Quantity).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Quantity).GreaterThan(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
        
        RuleFor(r => r.Note)
            .MaximumLength(200)
            .When(r => r.Note != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}

