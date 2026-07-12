using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Vehicles.Commands.Update;

internal sealed class UpdateVehicleValidator : Validator<UpdateVehicleRequest>
{
    public UpdateVehicleValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateVehicleDtoValidator());
    }
}

/// <summary>
/// Validator for the <see cref="UpdateVehicleDto"/> to ensure that all fields
/// meet the required validation criteria when creating a vehicle.
/// </summary>
/// <remarks>
/// This validator employs FluentValidation to enforce constraints on the properties of
/// <see cref="UpdateVehicleDto"/>. It includes checks for required fields, maximum length,
/// and valid value ranges to ensure the integrity of the submitted vehicle data.
/// </remarks>
public sealed class UpdateVehicleDtoValidator : Validator<UpdateVehicleDto>
{
    public UpdateVehicleDtoValidator()
    {
        RuleFor(dto => dto.Name).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(dto => dto.Name).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(dto => dto.MaxWeight).GreaterThan(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
    }
}