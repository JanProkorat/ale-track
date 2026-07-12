using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Notes.Commands.Create.Client;

/// <summary>
/// Validator for the <see cref="CreateClientNoteRequest"/> class.
/// </summary>
public sealed class CreateClientNoteValidator : Validator<CreateClientNoteRequest>
{
    public CreateClientNoteValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateNoteDtoValidator());
    }
}
