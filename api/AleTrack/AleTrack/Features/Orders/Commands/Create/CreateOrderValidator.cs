using System.Data;
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.Orders.Utils;
using AleTrack.Features.Reminders.Commands.Create;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Orders.Commands.Create;

/// <summary>
/// Validates the properties of the CreateOrderRequest object to ensure they meet the required criteria.
/// </summary>
/// <remarks>
/// This validator enforces the following rules:
/// - The Data property must not be null. A specific error code is generated if this validation fails.
/// - The Data property must adhere to the validation rules defined by the CreateOrderDtoValidator.
/// </remarks>
public sealed class CreateOrderRequestValidator : Validator<CreateOrderRequest>
{
    public CreateOrderRequestValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateOrderDtoValidator());
    }
}

/// <summary>
/// Validates the properties of the CreateOrderDto object to ensure they meet the required criteria.
/// </summary>
/// <remarks>
/// This validator enforces the following rules:
/// - The ClientId must not be null. A specific error code is generated if this validation fails.
/// - The DeliveryDate, if provided, must be greater than the current UTC date and time. A specific error code is generated if this validation fails.
/// - The OrderItems collection, if not empty, requires each item to meet the validation criteria defined by the CreateOrderItemDtoValidator.
/// </remarks>
public sealed class CreateOrderDtoValidator : Validator<CreateOrderDto>
{
    public CreateOrderDtoValidator()
    {
        RuleFor(r => r.ClientId).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);

        RuleFor(r => r.RequiredDeliveryDate)
            .GreaterThan(DateOnly.FromDateTime(DateTime.Today))
            .When(d => d.RequiredDeliveryDate != null)
            .WithErrorCode(ErrorCodes.DeliveryDateInPast)
            .WithMessage("Required delivery date must be in the future.");

        RuleFor(r => r.DeliveryAddressKind)
            .IsInEnum()
            .WithErrorCode(ErrorCodes.ValidationEnumError);

        // The enum and the FK can disagree; the schema cannot express the
        // pairing, so it is enforced here — mirroring
        // ClientOrderShipmentDtoValidator so the two surfaces stay identical.
        RuleFor(r => r.ClientDeliveryPlaceId)
            .NotNull()
            .WithErrorCode(ErrorCodes.ValidationNotNullError)
            .When(r => r.DeliveryAddressKind == DeliveryAddressKind.DeliveryPlace);

        RuleFor(r => r.ClientDeliveryPlaceId)
            .Null()
            .WithErrorCode(ErrorCodes.ValidationError)
            .When(r => r.DeliveryAddressKind != DeliveryAddressKind.DeliveryPlace);

        RuleFor(r => r.Notes)
            .ForEach(n => n.SetValidator(new OrderNoteDtoValidator()))
            .When(r => r.Notes.Count > 0);

        RuleFor(r => r.OrderItems)
            .ForEach(i => i.SetValidator(new CreateOrderItemDtoValidator()))
            .When(i => i.OrderItems.Count > 0);

        RuleFor(r => r.Returns)
            .ForEach(i => i.SetValidator(new OrderReturnDtoValidator()))
            .When(i => i.Returns.Count > 0);

        RuleFor(r => r.CustomExtraItems)
            .ForEach(e => e.SetValidator(new OrderCustomExtraItemDtoValidator()))
            .When(r => r.CustomExtraItems.Count > 0);
    }
}

/// <summary>
/// Validates the properties of the CreateOrderItemDto object to ensure they meet the required criteria.
/// </summary>
/// <remarks>
/// This validator checks the following rules:
/// - The ProductId must not be null. A specific error code is generated if this validation fails.
/// - The Quantity must be greater than 0. A specific error code is generated if this validation fails.
/// </remarks>
public sealed class CreateOrderItemDtoValidator : Validator<CreateOrderItemDto>
{
    public CreateOrderItemDtoValidator()
    {
        RuleFor(r => r.ProductId).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Quantity).GreaterThan(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
        RuleFor(r => r.ReminderState).IsInEnum().When(r => r.ReminderState != null);
    }
}