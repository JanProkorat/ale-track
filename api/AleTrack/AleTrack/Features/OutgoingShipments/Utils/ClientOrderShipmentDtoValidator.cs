using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Validator for the <see cref="ClientOrderShipmentDto"/> object. Ensures that the properties of the
/// data transfer object meet the defined validation rules for client order shipments.
/// </summary>
public sealed class ClientOrderShipmentDtoValidator : Validator<ClientOrderShipmentDto>
{
    public ClientOrderShipmentDtoValidator()
    {
        RuleFor(dto => dto.ClientOrderId)
            .NotNull()
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
        
        RuleFor(dto => dto.Order)
            .NotNull()
            .WithErrorCode(ErrorCodes.ValidationNotNullError);

        RuleFor(dto => dto.Order)
            .GreaterThan(0)
            .WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
        
        RuleFor(dto => dto.SelectedAddressKind)
            .NotNull()
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
        
        RuleFor(dto => dto.SelectedAddressKind)
            .IsInEnum()
            .WithErrorCode(ErrorCodes.ValidationEnumError);

        // The enum and the FK can disagree; the schema cannot express the
        // pairing, so it is enforced here.
        RuleFor(dto => dto.ClientDeliveryPlaceId)
            .NotNull()
            .WithErrorCode(ErrorCodes.ValidationNotNullError)
            .When(dto => dto.SelectedAddressKind == OutgoingShipmentStopAddressKind.DeliveryPlace);

        RuleFor(dto => dto.ClientDeliveryPlaceId)
            .Null()
            .WithErrorCode(ErrorCodes.ValidationError)
            .When(dto => dto.SelectedAddressKind != OutgoingShipmentStopAddressKind.DeliveryPlace);
    }
}