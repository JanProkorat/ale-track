using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Notes.Commands.Create;

/// <summary>
/// Validator for the <see cref="CreateNoteDto"/> class.
/// </summary>
public sealed class CreateNoteDtoValidator : Validator<CreateNoteDto>
{
    public CreateNoteDtoValidator()
    {
        RuleFor(r => r.Text).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Text).MaximumLength(1000).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
    }
}
