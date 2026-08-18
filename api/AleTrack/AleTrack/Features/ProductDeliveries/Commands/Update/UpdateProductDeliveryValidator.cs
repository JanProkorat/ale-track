using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.ProductDeliveries.Utils;
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
/// Handles validation of high-level properties, such as DeliveryDate and Note, and delegates the
/// rest to <see cref="UpdateProductDeliveryStopDtoValidator"/>.
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
            .Custom((stops, context) => DeliveryStopRules.RejectRepeatedPlaces(stops
                .Select(s => (s.Kind, s.BreweryId, s.SupplierId)), context));
    }
}

/// <summary>
/// Validator for the <see cref="UpdateProductDeliveryStopDto"/> to ensure that the stop names the one
/// place its kind calls for, and that its lines are the kind of thing that place has.
/// Delegates validation of individual lines to <see cref="UpdateProductDeliveryItemDtoValidator"/>.
/// </summary>
public sealed class UpdateProductDeliveryStopDtoValidator : Validator<UpdateProductDeliveryStopDto>
{
    public UpdateProductDeliveryStopDtoValidator()
    {
        RuleFor(r => r.BreweryId)
            .NotNull()
            .When(r => r.Kind == DeliveryStopKind.Brewery)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.BreweryId)
            .Null()
            .When(r => r.Kind != DeliveryStopKind.Brewery)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);

        RuleFor(r => r.SupplierId)
            .NotNull()
            .When(r => r.Kind == DeliveryStopKind.Supplier)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.SupplierId)
            .Null()
            .When(r => r.Kind != DeliveryStopKind.Supplier)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);

        RuleFor(r => r.Label)
            .NotEmpty()
            .When(r => r.Kind == DeliveryStopKind.Custom)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Label)
            .MaximumLength(100)
            .When(r => r.Label != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(r => r.Latitude)
            .NotNull()
            .When(r => r.Kind == DeliveryStopKind.Custom)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Longitude)
            .NotNull()
            .When(r => r.Kind == DeliveryStopKind.Custom)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);

        RuleFor(r => r.Note)
            .MaximumLength(200)
            .When(r => r.Note != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);

        RuleFor(r => r.Products)
            .ForEach(r => r.SetValidator(new UpdateProductDeliveryItemDtoValidator()))
            .When(r => r.Products.Count > 0);

        RuleFor(r => r.Products)
            .Custom((products, context) => DeliveryStopRules.RejectMismatchedLines(
                context.InstanceToValidate.Kind,
                products.Select(p => (p.ProductId, p.SupplierGoodId, p.ChargeKind)),
                context));
    }
}

/// <summary>
/// Validator for the <see cref="UpdateProductDeliveryItemDto"/> to ensure that the provided line
/// names exactly one thing to collect, at a resolvable price, in a sane quantity.
/// </summary>
public sealed class UpdateProductDeliveryItemDtoValidator : Validator<UpdateProductDeliveryItemDto>
{
    public UpdateProductDeliveryItemDtoValidator()
    {
        RuleFor(r => r).Custom((item, context) => DeliveryStopRules.RejectAmbiguousSource(
            item.ProductId, item.SupplierGoodId, item.ChargeKind, context));

        RuleFor(r => r.Quantity).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Quantity).GreaterThan(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);

        RuleFor(r => r.Note)
            .MaximumLength(200)
            .When(r => r.Note != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
