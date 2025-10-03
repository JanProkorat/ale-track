using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Notes.Commands.Update.Client;

/// <summary>
/// Validator for the <see cref="UpdateClientNoteRequest"/> class.
/// </summary>
public sealed class UpdateClientNoteValidator : Validator<UpdateClientNoteRequest>
{
    public UpdateClientNoteValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateNoteDtoValidator());
    }
}
