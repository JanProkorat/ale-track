using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Reminders.Commands.Update.Brewery;

/// <summary>
/// Validator for the <see cref="UpdateBreweryReminderRequest"/> that ensures required
/// properties are not null and applies additional validation rules.
/// </summary>
/// <remarks>
/// This validator checks:
/// <list type="bullet">
/// <item><description>The <see cref="UpdateBreweryReminderRequest.Id"/> property is not null.</description></item>
/// <item><description>The <see cref="UpdateBreweryReminderRequest.Data"/> property is not null.</description></item>
/// <item><description>The <see cref="UpdateBreweryReminderRequest.Data"/> property is validated using <see cref="UpdateReminderDtoValidator"/>.</description></item>
/// </list>
/// Error codes are applied to invalid fields as defined in <see cref="ErrorCodes"/>.
/// </remarks>
public sealed class UpdateBreweryReminderValidator : Validator<UpdateBreweryReminderRequest>
{
    public UpdateBreweryReminderValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateReminderDtoValidator());
    }
}