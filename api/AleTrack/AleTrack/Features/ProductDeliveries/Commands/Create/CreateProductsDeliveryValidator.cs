using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.ProductDeliveries.Utils;
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
            .Custom((stops, context) => DeliveryStopRules.RejectRepeatedPlaces(stops
                .Select(s => (s.Kind, s.BreweryId, s.SupplierId)), context));
    }
}

/// <summary>
/// Validator for the <see cref="CreateProductDeliveryStopDto"/> to ensure that the provided data adheres to defined validation rules and constraints.
/// Validates that the stop names the one place its kind calls for, and that its lines are the kind
/// of thing that place has.
/// Delegates validation of individual product entries to <see cref="CreateProductDeliveryItemDtoValidator"/>.
/// </summary>
public sealed class CreateProductDeliveryStopDtoValidator : Validator<CreateProductDeliveryStopDto>
{
    public CreateProductDeliveryStopDtoValidator()
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
            .ForEach(r => r.SetValidator(new CreateProductDeliveryItemDtoValidator()))
            .When(r => r.Products.Count > 0);

        RuleFor(r => r.Products)
            .Custom((products, context) => DeliveryStopRules.RejectMismatchedLines(
                context.InstanceToValidate.Kind,
                products.Select(p => (p.ProductId, p.SupplierGoodId, p.ChargeKind)),
                context));
    }
}

/// <summary>
/// Validator for the <see cref="CreateProductDeliveryItemDto"/> to ensure that the provided line
/// names exactly one thing to collect, at a resolvable price, in a sane quantity.
/// </summary>
public sealed class CreateProductDeliveryItemDtoValidator : Validator<CreateProductDeliveryItemDto>
{
    public CreateProductDeliveryItemDtoValidator()
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
