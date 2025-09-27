import {t} from "i18next";

import {ReminderType, ReminderRecurrenceType} from "../../../../api/Client";

import type {CreateReminderDto, UpdateReminderDto} from "../../../../api/Client";

export function validateReminder(
    {
        name,
        type,
        recurrenceType,
        numberOfDaysToRemindBefore,
        daysOfMonth,
        daysOfWeek,
        occurrenceDate,
        activeUntil
    }: CreateReminderDto | UpdateReminderDto): Record<string, string> {
    const validationErrors: Record<string, string> = {};

    if (name === '') validationErrors.name = t('common.required');
    if (numberOfDaysToRemindBefore === undefined) validationErrors.numberOfDaysToRemindBefore = t('common.required');

    if (type === ReminderType.OneTimeEvent) {
        if (!occurrenceDate) validationErrors.occurrenceDate = t('common.required');
    }
    if (type === ReminderType.Regular) {

        if (activeUntil === undefined) validationErrors.activeUntil = t('common.required');
        if (recurrenceType === undefined) validationErrors.recurrenceType = t('common.required');

        if (recurrenceType === ReminderRecurrenceType.Weekly)
            if (daysOfWeek === undefined || daysOfWeek.length === 0) validationErrors.daysOfWeek = t('common.required');

        if (recurrenceType === ReminderRecurrenceType.Monthly)
            if (daysOfMonth === undefined || daysOfMonth.length === 0) validationErrors.daysOfMonth = t('common.required');

    }
    return validationErrors;
}