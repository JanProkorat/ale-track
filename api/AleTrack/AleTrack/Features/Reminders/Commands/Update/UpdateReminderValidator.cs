using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Reminders.Commands.Update;

public sealed class UpdateReminderValidator : Validator<UpdateReminderRequest>
{
    public UpdateReminderValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new UpdateReminderDtoValidator());
    }
}

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