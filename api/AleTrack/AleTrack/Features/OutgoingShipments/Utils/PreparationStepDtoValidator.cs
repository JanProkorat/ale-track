using AleTrack.Common.Utils;
using FluentValidation;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Validator for a single <see cref="PreparationStepDto"/>, shared by the create and update
/// endpoints — the editor writes the same checklist on both paths.
/// </summary>
public sealed class PreparationStepDtoValidator : AbstractValidator<PreparationStepDto>
{
    public PreparationStepDtoValidator()
    {
        RuleFor(dto => dto.Label)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);

        RuleFor(dto => dto.Label)
            .MaximumLength(200)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
