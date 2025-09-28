using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Reminders.Commands.Create.Client;

/// <summary>
/// Validator for the <see cref="CreateClientReminderRequest"/> class.
/// Ensures that the data provided in the request is valid by applying specific validation rules.
/// </summary>
public sealed class CreateClientReminderValidator : Validator<CreateClientReminderRequest>
{
    public CreateClientReminderValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateReminderDtoValidator());
    }
}