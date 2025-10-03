using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Notes.Commands.Update;

/// <summary>
/// Validator for the <see cref="UpdateNoteDto"/> class.
/// </summary>
public sealed class UpdateNoteDtoValidator : Validator<UpdateNoteDto>
{
    public UpdateNoteDtoValidator()
    {
        RuleFor(r => r.Text).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Text).MaximumLength(1000).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
