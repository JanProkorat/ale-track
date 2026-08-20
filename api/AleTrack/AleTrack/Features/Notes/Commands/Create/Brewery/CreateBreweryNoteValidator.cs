using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Notes.Commands.Create.Brewery;

/// <summary>
/// Validator for the <see cref="CreateBreweryNoteRequest"/> class.
/// </summary>
public sealed class CreateBreweryNoteValidator : Validator<CreateBreweryNoteRequest>
{
    public CreateBreweryNoteValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateNoteDtoValidator());
    }
}
