using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Reminders.Commands.Update.Client;

/// <summary>
/// Validator class for validating the <see cref="UpdateClientReminderRequest"/>.
/// Ensures that required fields are not null and applies additional rules
/// for nested validation on the data structure.
/// </summary>
public sealed class UpdateClientReminderValidator : Validator<UpdateClientReminderRequest>
{
    public UpdateClientReminderValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateReminderDtoValidator());
    }
}