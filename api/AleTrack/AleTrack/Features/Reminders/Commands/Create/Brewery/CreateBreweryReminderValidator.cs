using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Reminders.Commands.Create.Brewery;

/// <summary>
/// Validator for <see cref="CreateBreweryReminderRequest"/>.
/// Ensures that required fields in the request are validated properly.
/// </summary>
/// <remarks>
/// This class checks the following:
/// 1. The <see cref="CreateBreweryReminderRequest.Data"/> property is not null and throws a validation error if it is.
/// 2. Delegates additional validation of <see cref="CreateBreweryReminderRequest.Data"/> to <see cref="CreateReminderDtoValidator"/>.
/// </remarks>
public sealed class CreateBreweryReminderValidator : Validator<CreateBreweryReminderRequest>
{
    public CreateBreweryReminderValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateReminderDtoValidator());
    }
}