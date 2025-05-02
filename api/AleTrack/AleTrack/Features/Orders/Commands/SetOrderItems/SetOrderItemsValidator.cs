using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Orders.Commands.SetOrderItems;

/// <summary>
/// A validator for the <see cref="SetOrderItemsRequest"/> class.
/// Ensures that the request object and its associated data meet the required validation rules.
/// </summary>
public sealed class SetOrderItemsValidator : Validator<SetOrderItemsRequest>
{
    public SetOrderItemsValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new SetOrderItemsDtoValidator());
    }
}

/// <summary>
/// A validator for the <see cref="SetOrderItemsDto"/> class.
/// Validates that the order items data transfer object adheres to defined validation criteria,
/// including validation of each individual order item within the collection.
/// </summary>
public sealed class SetOrderItemsDtoValidator : AbstractValidator<SetOrderItemsDto>
{
    public SetOrderItemsDtoValidator()
    {
        RuleFor(r => r.OrderItems)
            .ForEach(i => i.SetValidator(new OrderItemDtoValidator()))
            .When(r => r.OrderItems.Count > 0);
    }
}

/// <summary>
/// A validator for the <see cref="OrderItemDto"/> class.
/// Ensures that the data transfer object adheres to the required validation rules,
/// validating properties such as product identifier and quantity.
/// </summary>
public sealed class OrderItemDtoValidator : Validator<OrderItemDto>
{
    public OrderItemDtoValidator()
    {
        RuleFor(r => r.ProductId).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Quantity).GreaterThan(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
    }
}