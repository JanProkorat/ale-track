using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.InventoryItems.Commands.Update;

/// <summary>
/// Validates the request to update an inventory item in the system.
/// </summary>
/// <remarks>
/// This validator checks the following:
/// 1. The Id field must not be null.
/// 2. The Data object must not be null.
/// 3. The Data object must satisfy the rules defined in <see cref="UpdateInventoryItemDtoValidator"/>.
/// </remarks>
public sealed class UpdateInventoryItemValidator : Validator<UpdateInventoryItemRequest>
{
    public UpdateInventoryItemValidator()
    {
        RuleFor(x => x.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateInventoryItemDtoValidator());
    }
}

/// <summary>
/// Validates the data transfer object for updating an inventory item in the system.
/// </summary>
/// <remarks>
/// This validator ensures the following:
/// 1. The Amount field must not be null and must be greater than 0.
/// 2. Either the ProductId or Name field must be null if the other is provided.
/// 3. Validation adheres to the constraints required for each property of <see cref="UpdateInventoryItemDto"/>.
/// </remarks>
public sealed class UpdateInventoryItemDtoValidator : Validator<UpdateInventoryItemDto>
{
    public UpdateInventoryItemDtoValidator()
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
