using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Reminders.Commands.Update;

/// <summary>
/// Validator for the <see cref="UpdateReminderDto"/> class, ensuring compliance with business rules and validation constraints.
/// </summary>
/// <remarks>
/// The validation rules enforced in this validator are as follows:
/// - The Name property must not be null and must not exceed 100 characters in length.
/// - The Description property must not exceed 2000 characters if provided.
/// - The Type property must not be null.
/// - If the Type property is set to ReminderType.OneTimeEvent, the OccurrenceDate property must not be null.
/// - The NumberOfDaysToRemindBefore property must not be null.
/// - If the Type property is set to ReminderType.Regular, the RecurrenceType property must not be null.
/// - If the RecurrenceType property is set to Weekly, the DaysOfWeek property must not be null.
/// - If the RecurrenceType property is set to Monthly, the DaysOfMonth property must not be null.
/// - If the Type property is set to ReminderType.Regular, the ActiveUntil property must not be null.
/// </remarks>
public sealed class UpdateReminderDtoValidator : Validator<UpdateReminderDto>
{
    public UpdateReminderDtoValidator()
    {
        RuleFor(r => r.Name).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Name).MaximumLength(100).WithErrorCode(ErrorCodes.ValidationMaxLengthError);

        RuleFor(r => r.Description)
            .MaximumLength(2000)
            .When(r => r.Description != null)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        
        RuleFor(r => r.Type).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.OccurrenceDate)
            .NotNull()
            .When(r => r.Type == ReminderType.OneTimeEvent)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);

        RuleFor(r => r.NumberOfDaysToRemindBefore).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);

        RuleFor(r => r.RecurrenceType)
            .NotNull()
            .When(r => r.Type == ReminderType.Regular)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
        
        RuleFor(r => r.DaysOfWeek)
            .NotNull()
            .When(r => r.Type == ReminderType.Regular && r.RecurrenceType == ReminderRecurrenceType.Weekly)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
        
        RuleFor(r => r.DaysOfMonth)
            .NotNull()
            .When(r => r.Type == ReminderType.Regular && r.RecurrenceType == ReminderRecurrenceType.Monthly)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
        
        RuleFor(r => r.ActiveUntil)
            .NotNull()
            .When(r => r.Type == ReminderType.Regular)
            .WithErrorCode(ErrorCodes.ValidationNotNullError);
    }
}