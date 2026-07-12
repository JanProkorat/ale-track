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
        
        RuleForEach(dto => dto.ClientOrderShipments)
            .SetValidator(new ClientOrderShipmentDtoValidator());
    }
}