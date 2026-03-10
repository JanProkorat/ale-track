using AleTrack.Common.Utils;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.OutgoingShipments.Utils;

public class ExtraShipmentDtoValidator : Validator<ExtraShipmentDto>
{
    public ExtraShipmentDtoValidator()
    {
        RuleFor(dto => dto.Quantity)
            .GreaterThan(0)
            .WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
        
        RuleFor(dto => dto.ProductName)
            .MaximumLength(200)
            .When(dto => dto.ProductName != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}