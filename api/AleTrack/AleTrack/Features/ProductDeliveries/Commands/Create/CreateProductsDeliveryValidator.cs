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
/// and delegates validation of nested product items to <see cref="CreateProductDeliveryItemDtoValidator"/>.
/// </summary>
public sealed class CreateProductsDeliveryDtoValidator : Validator<CreateProductsDeliveryDto>
{
    public CreateProductsDeliveryDtoValidator()
    {
        RuleFor(r => r.DeliveryDate).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Note)
            .MaximumLength(200)
            .When(r => r.Note != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(r => r.Stops)
            .ForEach(r => r.SetValidator(new CreateProductDeliveryStopDtoValidator()))
            .When(r => r.Stops.Count > 0);
        
        RuleFor(r => r.Stops)
            .Custom((stops, context) =>
            {
                var duplicateIds = stops
                    .GroupBy(s => s.BreweryId)
                    .Where(g => g.Count() > 1 && g.Key != null)
                    .Select(g => g.Key)
                    .ToList();

                if (duplicateIds.Count > 0)
                {
                    context.AddFailure("Stops", $"Nelze zadat více stejných pivovarů: {string.Join(", ", duplicateIds)}");
                }
            });
    }
}

/// <summary>
/// Validator for the <see cref="CreateProductDeliveryStopDto"/> to ensure that the provided data adheres to defined validation rules and constraints.
/// Validates critical properties such as the brewery identifier and the collection of delivered products.
/// Delegates validation of individual product entries to <see cref="CreateProductDeliveryItemDtoValidator"/>.
/// </summary>
public sealed class CreateProductDeliveryStopDtoValidator : Validator<CreateProductDeliveryStopDto>
{
    public CreateProductDeliveryStopDtoValidator()
    {
        RuleFor(r => r.BreweryId).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        
        RuleFor(r => r.Note)
            .MaximumLength(200)
            .When(r => r.Note != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(r => r.Products)
            .ForEach(r => r.SetValidator(new CreateProductDeliveryItemDtoValidator()))
            .When(r => r.Products.Count > 0);
        
        RuleFor(r => r.Products)
            .Custom((products, context) =>
            {
                var duplicateIds = products
                    .GroupBy(s => s.ProductId)
                    .Where(g => g.Count() > 1 && g.Key != null)
                    .Select(g => g.Key)
                    .ToList();

                if (duplicateIds.Count > 0)
                {
                    context.AddFailure("Products", $"Nelze zadat více stejných produktů: {string.Join(", ", duplicateIds)}");
                }
            });
    }
}

/// <summary>
/// Validator for the <see cref="CreateProductDeliveryItemDto"/> to ensure that the provided product item details
/// adhere to the defined validation rules and constraints.
/// Validates key properties such as ProductId and Quantity, and enforces optional constraints such as
/// maximum length for the Note field.
/// </summary>
public sealed class CreateProductDeliveryItemDtoValidator : Validator<CreateProductDeliveryItemDto>
{
    public CreateProductDeliveryItemDtoValidator()
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
