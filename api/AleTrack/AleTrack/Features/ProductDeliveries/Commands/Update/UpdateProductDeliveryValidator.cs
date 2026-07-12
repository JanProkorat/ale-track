using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.ProductDeliveries.Commands.Update;

/// <summary>
/// Validator for <see cref="UpdateProductDeliveryRequest"/> that enforces business rules and validation logic
/// for updating product delivery data.
/// </summary>
/// <remarks>
/// This validator ensures that the provided request and its nested properties adhere to specific
/// constraints such as mandatory fields and length limits.
/// Rules applied:
/// - Id must not be null.
/// - Data property is validated using <see cref="UpdateProductDeliveryDtoValidator"/>.
/// </remarks>
public sealed class UpdateProductDeliveryValidator : Validator<UpdateProductDeliveryRequest>
{
    public UpdateProductDeliveryValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateProductDeliveryDtoValidator());
    }
}

/// <summary>
/// Validator for the <see cref="UpdateProductDeliveryDto"/> to ensure that the provided delivery details
/// comply with all required rules and constraints.
/// Handles validation of high-level properties, such as BreweryId, DeliveryDate, Note,
/// and delegates validation of nested product items to <see cref="UpdateProductDeliveryStopDtoValidator"/>.
/// </summary>
public sealed class UpdateProductDeliveryDtoValidator : Validator<UpdateProductDeliveryDto>
{
    public UpdateProductDeliveryDtoValidator()
    {
        RuleFor(r => r.DeliveryDate).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Note)
            .MaximumLength(200)
            .When(r => r.Note != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(r => r.Stops)
            .ForEach(r => r.SetValidator(new UpdateProductDeliveryStopDtoValidator()))
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
/// Validator for the <see cref="UpdateProductDeliveryStopDto"/> to ensure that the provided data adheres to defined validation rules and constraints.
/// Validates critical properties such as the brewery identifier and the collection of delivered products.
/// Delegates validation of individual product entries to <see cref="UpdateProductDeliveryItemDtoValidator"/>.
/// </summary>
public sealed class UpdateProductDeliveryStopDtoValidator : Validator<UpdateProductDeliveryStopDto>
{
    public UpdateProductDeliveryStopDtoValidator()
    {
        RuleFor(r => r.BreweryId).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        
        RuleFor(r => r.Note)
            .MaximumLength(200)
            .When(r => r.Note != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(r => r.Products)
            .ForEach(r => r.SetValidator(new UpdateProductDeliveryItemDtoValidator()))
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
/// Validator for the <see cref="UpdateProductDeliveryItemDto"/> to ensure that the provided product item details
/// adhere to the defined validation rules and constraints.
/// Validates key properties such as ProductId and Quantity, and enforces optional constraints such as
/// maximum length for the Note field.
/// </summary>
public sealed class UpdateProductDeliveryItemDtoValidator : Validator<UpdateProductDeliveryItemDto>
{
    public UpdateProductDeliveryItemDtoValidator()
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
