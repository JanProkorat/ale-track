using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.InventoryItems.Commands.Create;

/// <summary>
/// Validator for the <see cref="CreateInventoryItemRequest"/> model.
/// </summary>
/// <remarks>
/// This class provides validation rules for creating a new inventory item.
/// It verifies that the data payload within the request is not null and applies additional
/// validation rules defined in <see cref="CreateInventoryItemDtoValidator"/> to ensure the
/// correctness of the inventory item details.
/// </remarks>
/// <example>
/// This validator is automatically invoked during the processing pipeline of a FastEndpoints request
/// to ensure the input data meets the defined validation rules.
/// </example>
public sealed class CreateInventoryItemValidator : Validator<CreateInventoryItemRequest>
{
    public CreateInventoryItemValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateInventoryItemDtoValidator());
    }
}

/// <summary>
/// Validator for the <see cref="CreateInventoryItemDto"/> model.
/// </summary>
/// <remarks>
/// This class defines validation rules for the data within the `CreateInventoryItemDto`.
/// It ensures that the mandatory fields are populated correctly and enforces conditional
/// constraints between related properties (`ProductId` and `Name`).
/// </remarks>
/// <example>
/// This validator is used to guarantee the consistency and correctness of the inventory item details
/// when creating new inventory items. It ensures the data conforms to the expected business rules.
/// </example>
public sealed class CreateInventoryItemDtoValidator : Validator<CreateInventoryItemDto>
{
    public CreateInventoryItemDtoValidator()
    {
        RuleFor(r => r.Quantity).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Quantity).GreaterThan(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);

        RuleFor(r => r.ProductId)
            .Null()
            .When(r => r.Name != null)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
        
        RuleFor(r => r.Name)
            .Null()
            .When(r => r.ProductId != null)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
    }
}
