import {useTranslation} from "react-i18next";
import React, {useState, useEffect} from "react";

import Box from "@mui/material/Box";
import {FormControl} from "@mui/material";
import TextField from "@mui/material/TextField";

import {NameInput} from "./components/name-input";
import {validateReminder} from "./utils/validate-reminder";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {DaysOfWeekPicker} from "./components/days-of-week-picker";
import {ReminderDaysInput} from "./components/reminder-days-input";
import {DaysOfMonthPicker} from "./components/days-of-month-picker";
import {ReminderDatePicker} from "./components/reminder-date-picker";
import {ReminderTypeSelect} from "./components/reminder-type-select";
import {DrawerLayout} from "../../../layouts/components/drawer-layout";
import {SectionHeader} from "../../../components/label/section-header";
import {useEntityStatsRefresh} from "../../../providers/EntityStatsContext";
import {ReminderRecurrenceTypeSelect} from "./components/reminder-recurrence-type-select";
import {ReminderType, CreateReminderDto, ReminderRecurrenceType} from "../../../api/Client";

import type {DayOfWeek} from "../../../api/Client";

type CreateReminderViewProps = {
    parentId: string,
    parentType: "brewery" | "client",
    selectedType: ReminderType,
    onClose: (shouldRefresh: boolean) => void
};

function CreateReminderView({parentId, parentType, selectedType, onClose}: Readonly<CreateReminderViewProps>) {
    const {showSnackbar} = useSnackbar();
    const {t} = useTranslation();
    const {triggerRefresh} = useEntityStatsRefresh();

    const [reminder, setReminder] = useState<CreateReminderDto>(new CreateReminderDto({
        name: "",
        type: selectedType,
        activeUntil: undefined,
        daysOfMonth: [],
        daysOfWeek: [],
        description: "",
        numberOfDaysToRemindBefore: 0,
        occurrenceDate: new Date(),
        recurrenceType: undefined
    }));

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        handleTypeSelect(selectedType);
    }, [selectedType])

    const saveReminder = async (): Promise<void> => {
        setErrors({});
        const newErrors = validateReminder(reminder);

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            showSnackbar(t('common.validationError'), 'error');
            return;
        }

        try {
            const clientApi = new AuthorizedClient();
            switch (parentType) {
                case "client":
                    await clientApi.createClientReminderEndpoint(parentId, reminder.toJSON());
                    break;
                case "brewery":
                default:
                    await clientApi.createBreweryReminderEndpoint(parentId, reminder.toJSON());
                    break;
            }

            triggerRefresh();

            showSnackbar(t('reminders.saveSuccess'), 'success');
            onClose(true);
        } catch (error) {
            console.error('Error saving reminder:', error);
            showSnackbar(t('reminders.saveError'), 'error');
            return;
        }
    }

    const handleOccurrenceDateSelect = (date: Date) => {
        setReminder(prev => new CreateReminderDto({
            ...prev,
            occurrenceDate: date
        }))
    }

    const handleActiveUntilDateSelect = (date: Date) => {
        setReminder(prev => new CreateReminderDto({
            ...prev,
            activeUntil: date
        }))
    }

    const handleTypeSelect = (type: ReminderType) => {
        setReminder(prev => new CreateReminderDto({
            ...prev,
            type,
            recurrenceType: type === ReminderType.Regular
                ? (prev.recurrenceType ?? ReminderRecurrenceType.Weekly)
                : undefined,
            daysOfWeek: type === ReminderType.OneTimeEvent ? undefined : prev.daysOfWeek,
            daysOfMonth: type === ReminderType.OneTimeEvent ? undefined : prev.daysOfMonth,
            activeUntil: type === ReminderType.OneTimeEvent ? undefined : prev.activeUntil,
            occurrenceDate: type == ReminderType.Regular ? undefined : prev.occurrenceDate
        }))
    }

    const handleRecurrenceTypeSelect = (type: ReminderRecurrenceType) => {
        setReminder(prev => new CreateReminderDto({
            ...prev,
            recurrenceType: type,
            daysOfWeek: type === ReminderRecurrenceType.Monthly ? undefined : prev.daysOfWeek,
            daysOfMonth: type === ReminderRecurrenceType.Weekly ? undefined : prev.daysOfMonth,
        }))
    }

    const handleReminderDaysSelect = (value: number) => {
        setReminder(prev => new CreateReminderDto({
            ...prev,
            numberOfDaysToRemindBefore: value
        }))
    }

    const handleReminderConcreteDaysOfWeekSelect = (days: DayOfWeek[]) => {
        setReminder(prev => new CreateReminderDto({
            ...prev,
            daysOfWeek: days
        }))
    }

    const handleReminderConcreteDaysOfMonthSelect = (days: number[]) => {
        setReminder(prev => new CreateReminderDto({
            ...prev,
            daysOfMonth: days
        }))
    }

    const handleNameSet = (name: string) => {
        setReminder(prev => new CreateReminderDto({
            ...prev,
            name
        }))
    }

    return (
        <DrawerLayout
            title={t('reminders.detailTitle')}
            isLoading={false}
            onClose={() => onClose(false)}
            onSaveAndClose={saveReminder}
        >
            <Box display="flex" alignItems="center" gap={1} sx={{mt: 1}}>
                <NameInput name={reminder.name ?? ''} setName={handleNameSet} errors={errors}/>

                <ReminderTypeSelect selectedType={reminder.type} errors={errors} onSelect={handleTypeSelect}/>
            </Box>

            <FormControl fullWidth sx={{mt: 2}}>
                <TextField
                    id="create-reminder-description"
                    label={t('reminders.description')}
                    multiline
                    minRows={4}
                    maxRows={10}
                    value={reminder.description ?? ''}
                    onChange={(e) =>
                        setReminder(prev => new CreateReminderDto({...prev, description: e.target.value}))
                    }
                    slotProps={{
                        input: {
                            inputProps: {maxLength: 2000}
                        }
                    }}
                />
            </FormControl>

            <SectionHeader text={t('reminders.displaySettings')} headerVariant="subtitle2" sx={{mt: 2}}/>

            {reminder.type === ReminderType.OneTimeEvent && (
                <Box display="flex" alignItems="center" gap={2} sx={{mt: 2}}>
                    <ReminderDatePicker
                        selectedDate={reminder.occurrenceDate}
                        label={t('reminders.occurrenceDate')}
                        onDatePicked={handleOccurrenceDateSelect}
                        sx={{minWidth: '50%'}}
                    />

                    <ReminderDaysInput
                        selectedValue={reminder.numberOfDaysToRemindBefore}
                        onSelectedValueChange={handleReminderDaysSelect}
                        errors={errors}
                    />
                </Box>
            )}
            {reminder.type == ReminderType.Regular && (
                <Box display="flex" gap={1} sx={{mt: 1}}>
                    <Box sx={{minWidth: "40%"}} gap={1} alignItems="center">
                        <ReminderRecurrenceTypeSelect
                            selectedType={reminder.recurrenceType ?? ReminderRecurrenceType.Weekly}
                            errors={errors}
                            onSelect={handleRecurrenceTypeSelect}
                        />
                        <Box sx={{mt: 1}} gap={1} alignItems="center">
                            <ReminderDatePicker
                                selectedDate={reminder.activeUntil}
                                label={t('reminders.activeUntilDate')}
                                onDatePicked={handleActiveUntilDateSelect}
                                sx={{minWidth: '100%'}}
                            />
                        </Box>
                        <ReminderDaysInput
                            selectedValue={reminder.numberOfDaysToRemindBefore}
                            onSelectedValueChange={handleReminderDaysSelect}
                            errors={errors}
                        />
                    </Box>
                    {reminder.recurrenceType === ReminderRecurrenceType.Weekly && (
                        <DaysOfWeekPicker
                            selectedDays={reminder.daysOfWeek!}
                            onDaysOfWeekPicked={handleReminderConcreteDaysOfWeekSelect}
                            errors={errors}
                        />
                    )}
                    {reminder.recurrenceType === ReminderRecurrenceType.Monthly && (
                        <DaysOfMonthPicker
                            selectedDays={reminder.daysOfMonth!}
                            onDaysOfMonthPicked={handleReminderConcreteDaysOfMonthSelect}
                            errors={errors}
                        />
                    )}
                </Box>
            )}
        </DrawerLayout>
    )
}

export default CreateReminderView