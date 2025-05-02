using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Vehicles.Commands.Create;

/// <summary>
/// Validator for the <see cref="CreateVehicleRequest"/> to ensure that all required fields
/// and properties adhere to the defined validation rules.
/// </summary>
/// <remarks>
/// This validator utilizes FluentValidation to enforce the correctness
/// of the request data submitted for creating a vehicle. Validation includes checking for
/// non-null, non-empty fields, as well as appropriate length and value constraints.
/// </remarks>
public sealed class CreateVehicleValidator : Validator<CreateVehicleRequest>
{
    public CreateVehicleValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateVehicleDtoValidator());
    }
}

/// <summary>
/// Validator for the <see cref="CreateVehicleDto"/> to ensure that all fields
/// meet the required validation criteria when creating a vehicle.
/// </summary>
/// <remarks>
/// This validator employs FluentValidation to enforce constraints on the properties of
/// <see cref="CreateVehicleDto"/>. It includes checks for required fields, maximum length,
/// and valid value ranges to ensure the integrity of the submitted vehicle data.
/// </remarks>
public sealed class CreateVehicleDtoValidator : Validator<CreateVehicleDto>
{
    public CreateVehicleDtoValidator()
    {
        RuleFor(dto => dto.Name).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(dto => dto.Name).MaximumLength(50).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(dto => dto.MaxWeight).GreaterThan(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
    }
}
