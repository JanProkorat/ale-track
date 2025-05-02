using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.ProductDeliveries.Commands.Create;

/// <summary>
/// Validator for the <see cref="CreateProductsDeliveryRequest"/> to ensure that the submitted data
/// complies with the necessary rules and constraints.
/// Validates the primary request payload and delegates validation of nested properties to
/// <see cref="CreateProductsDeliveryDtoValidator"/>.
/// </summary>
public sealed class CreateProductsDeliveryValidator : Validator<CreateProductsDeliveryRequest>
{
    public CreateProductsDeliveryValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateProductsDeliveryDtoValidator());
    }
}

/// <summary>
/// Validator for the <see cref="CreateProductsDeliveryDto"/> to ensure that the provided delivery details
/// comply with all required rules and constraints.
/// Handles validation of high-level properties, such as BreweryId, DeliveryDate, Note,
/// and delegates validation of nested product items to <see cref="ProductDeliveryItemDtoValidator"/>.
/// </summary>
public sealed class CreateProductsDeliveryDtoValidator : Validator<CreateProductsDeliveryDto>
{
    public CreateProductsDeliveryDtoValidator()
    {
        RuleFor(r => r.BreweryId).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.DeliveryDate).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Note)
            .MaximumLength(200)
            .When(r => r.Note != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(r => r.Products)
            .ForEach(r => r.SetValidator(new ProductDeliveryItemDtoValidator()))
            .When(r => r.Products.Count > 0);
    }
}

/// <summary>
/// Validator for the <see cref="ProductDeliveryItemDto"/> to ensure that the provided product item details
/// adhere to the defined validation rules and constraints.
/// Validates key properties such as ProductId and Quantity, and enforces optional constraints such as
/// maximum length for the Note field.
/// </summary>
public sealed class ProductDeliveryItemDtoValidator : Validator<ProductDeliveryItemDto>
{
    public ProductDeliveryItemDtoValidator()
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
