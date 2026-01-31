using AleTrack.Common.Utils;
using AleTrack.Features.OutgoingShipments.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.OutgoingShipments.Commands.Update;

/// <summary>
/// Validator for the <see cref="UpdateOutgoingShipmentRequest"/> object. Ensures that the data required for
/// updating an outgoing shipment adheres to the specified validation rules.
/// </summary>
public sealed class UpdateOutgoingShipmentValidator : Validator<UpdateOutgoingShipmentRequest>
{
    public UpdateOutgoingShipmentValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateOutgoingShipmentDtoValidator());
    }
}

/// <summary>
/// Validator for the <see cref="UpdateOutgoingShipmentDto"/> object. Ensures that the data required for
/// updating an outgoing shipment adheres to the specified validation rules.
/// </summary>
public sealed class UpdateOutgoingShipmentDtoValidator : AbstractValidator<UpdateOutgoingShipmentDto>
{
    public UpdateOutgoingShipmentDtoValidator()
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
        
        RuleFor(dto => dto.State)
            .NotNull()
            .WithErrorCode(ErrorCodes.ValidationNotNullError);

        RuleFor(r => r.State)
            .IsInEnum()
            .WithErrorCode(ErrorCodes.ValidationEnumError);

        RuleForEach(dto => dto.ClientOrderShipments)
            .SetValidator(new ClientOrderShipmentDtoValidator());
    }
}