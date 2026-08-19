using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.OutgoingShipments.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.OutgoingShipments.Commands.Create;

/// <summary>
/// Validator for the <see cref="CreateOutgoingShipmentRequest"/> object. Ensures that the data required for
/// creating an outgoing shipment adheres to the specified validation rules.
/// </summary>
public sealed class CreateOutgoingShipmentValidator : Validator<CreateOutgoingShipmentRequest>
{
    public CreateOutgoingShipmentValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateOutgoingShipmentDtoValidator());
    }
}

/// <summary>
/// Validator for the <see cref="CreateOutgoingShipmentDto"/> object. Ensures that the data required for
/// creating an outgoing shipment adheres to the specified validation rules.
/// </summary>
public sealed class CreateOutgoingShipmentDtoValidator : AbstractValidator<CreateOutgoingShipmentDto>
{
    public CreateOutgoingShipmentDtoValidator()
    {   
        RuleFor(dto => dto.Name)
            .NotNull()
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
        
        RuleFor(dto => dto.Name)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        
        RuleFor(dto => dto.Name)
            .MaximumLength(100)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(dto => dto.ClientOrderShipments)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);

        // A route can start at the company at most once — a second one would be a
        // second warehouse stop with no meaning on the route.
        RuleFor(dto => dto.CustomStops)
            .Must(stops => stops.Count(s => s.Kind == OutgoingShipmentStopKind.Company) <= 1)
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);

        // A pickup stop is a stop *at* a supplier, so it is meaningless without one — and the
        // handler would have nothing to take its label and coordinates from.
        RuleFor(dto => dto.CustomStops)
            .Must(stops => stops
                .Where(s => s.Kind == OutgoingShipmentStopKind.Supplier)
                .All(s => s.SupplierId is not null && s.SupplierId != Guid.Empty))
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);

        // One visit per supplier: two stops at the same plnírna is not a route, it is a mistake.
        RuleFor(dto => dto.CustomStops)
            .Must(stops =>
            {
                var ids = stops
                    .Where(s => s.Kind == OutgoingShipmentStopKind.Supplier)
                    .Select(s => s.SupplierId)
                    .ToList();
                return ids.Distinct().Count() == ids.Count;
            })
            .WithErrorCode(ErrorCodes.ValidationError);

        RuleForEach(dto => dto.ClientOrderShipments)
            .SetValidator(new ClientOrderShipmentDtoValidator());

        RuleForEach(dto => dto.PreparationSteps)
            .SetValidator(new PreparationStepDtoValidator());

        RuleFor(dto => dto.StartPointKind)
            .IsInEnum()
            .WithErrorCode(ErrorCodes.ValidationEnumError);

        RuleFor(dto => dto.StartBreweryId)
            .NotNull()
            .When(dto => dto.StartPointKind == ShipmentStartPointKind.Brewery)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);

        RuleFor(dto => dto.StartBreweryId)
            .Null()
            .When(dto => dto.StartPointKind == ShipmentStartPointKind.Company)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);

        RuleFor(dto => dto.StartBreweryAddressKind)
            .IsInEnum()
            .WithErrorCode(ErrorCodes.ValidationEnumError);

        // A brewery has no delivery-place navigation — only its official and
        // contact addresses can ever be a start point.
        RuleFor(dto => dto.StartBreweryAddressKind)
            .NotEqual(DeliveryAddressKind.DeliveryPlace)
            .WithErrorCode(ErrorCodes.ValidationEnumError);
    }
}