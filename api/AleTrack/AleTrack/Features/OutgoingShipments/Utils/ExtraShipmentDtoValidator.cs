using AleTrack.Common.Utils;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Validator for the <see cref="ExtraShipmentDto"/> class.
/// </summary>
public class ExtraShipmentDtoValidator : Validator<ExtraShipmentDto>
{
    public ExtraShipmentDtoValidator()
    {
        RuleFor(dto => dto.Quantity)
            .GreaterThan(0)
            .WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
    }
}

public class InventoryExtraShipmentDtoValidator : Validator<InventoryExtraShipmentDto>
{
    public InventoryExtraShipmentDtoValidator()
    {
        RuleFor(dto => dto.ProductId)
            .NotNull()
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
    }
}

public class ClientExtraShipmentDtoValidator : Validator<ClientExtraShipmentDto>
{
    public ClientExtraShipmentDtoValidator()
    {
        RuleFor(dto => dto.InventoryItemId)
            .NotNull()
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
    }
}

public class CustomExtraShipmentDtoValidator : Validator<CustomExtraShipmentDto>
{
    public CustomExtraShipmentDtoValidator()
    {
        RuleFor(dto => dto.Description)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        
        RuleFor(dto => dto.Description)
            .MaximumLength(200)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}