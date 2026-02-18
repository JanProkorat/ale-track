import { useTranslation } from 'react-i18next';
import { varAlpha } from 'minimal-shared/utils';
import React, { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { FormControl, LinearProgress } from '@mui/material';
import { linearProgressClasses } from '@mui/material/LinearProgress';

import { NameInput } from './components/name-input';
import { useApiCall } from '../../../hooks/use-api-call';
import { validateReminder } from './utils/validate-reminder';
import { mapEnumValue } from '../../../utils/format-enum-value';
import { useSnackbar } from '../../../providers/SnackbarProvider';
import { DaysOfWeekPicker } from './components/days-of-week-picker';
import { ReminderDaysInput } from './components/reminder-days-input';
import { DaysOfMonthPicker } from './components/days-of-month-picker';
import { ReminderTypeSelect } from './components/reminder-type-select';
import { ReminderDatePicker } from './components/reminder-date-picker';
import { useAuthorizedClient } from '../../../api/use-authorized-client';
import { DrawerLayout } from '../../../layouts/components/drawer-layout';
import { SectionHeader } from '../../../components/label/section-header';
import { ReminderRecurrenceTypeSelect } from './components/reminder-recurrence-type-select';
import { ReminderType, type DayOfWeek, UpdateReminderDto, ReminderRecurrenceType } from '../../../api/Client';

type UpdateReminderViewProps = {
     reminderId: string;
     parentType: 'brewery' | 'client';
     onClose: (shouldRefresh: boolean) => void;
};

export function UpdateReminderView({ reminderId, parentType, onClose }: Readonly<UpdateReminderViewProps>) {
     const { showSnackbar } = useSnackbar();
     const { t } = useTranslation();
     const { executeApiCall } = useApiCall();
     const clientApi = useAuthorizedClient();

     const [reminder, setReminder] = useState<UpdateReminderDto | undefined>(undefined);

     const [errors, setErrors] = useState<Record<string, string>>({});

     const fetchReminder = useCallback(
          async (id: string): Promise<void> => {
               try {
                    const data = await clientApi.getReminderDetailEndpoint(id);

                    const mappedType = mapEnumValue<ReminderType>(ReminderType, data.type);
                    const mappedRecurrence = mapEnumValue<ReminderRecurrenceType>(
                         ReminderRecurrenceType,
                         data.recurrenceType
                    );

                    setReminder(
                         new UpdateReminderDto({
                              ...data,
                              type: mappedType!,
                              recurrenceType: mappedRecurrence,
                              name: data.name ?? '',
                              description: data.description ?? '',
                              numberOfDaysToRemindBefore: data.numberOfDaysToRemindBefore ?? 0,
                         })
                    );
               } catch (error) {
                    console.error('Error fetching reminder:', error);
                    showSnackbar(t('reminders.loadDetailError'), 'error');
               }
          },
          [clientApi, showSnackbar, t]
     );

     useEffect(() => {
          if (reminderId !== undefined) fetchReminder(reminderId);
     }, [fetchReminder, reminderId]);

     const saveReminder = async (): Promise<void> => {
          setErrors({});
          const newErrors = validateReminder(reminder!);

          if (Object.keys(newErrors).length > 0) {
               setErrors(newErrors);
               showSnackbar(t('common.validationError'), 'error');
               return;
          }

          let hasError = false;

          switch (parentType) {
               case 'client':
                    await executeApiCall(
                         () => clientApi.updateClientReminderEndpoint(reminderId, reminder!.toJSON()),
                         undefined,
                         {
                              onError: () => {
                                   hasError = true;
                              },
                         }
                    );
                    break;
               case 'brewery':
               default:
                    await executeApiCall(
                         () => clientApi.updateBreweryReminderEndpoint(reminderId, reminder!.toJSON()),
                         undefined,
                         {
                              onError: () => {
                                   hasError = true;
                              },
                         }
                    );
                    break;
          }

          if (hasError) {
               return;
          }

          showSnackbar(t('reminders.saveSuccess'), 'success');
          onClose(true);
     };

     const handleOccurrenceDateSelect = (date: Date) => {
          setReminder(
               (prev) =>
                    new UpdateReminderDto({
                         ...prev!,
                         occurrenceDate: date,
                    })
          );
     };

     const handleActiveUntilDateSelect = (date: Date) => {
          setReminder(
               (prev) =>
                    new UpdateReminderDto({
                         ...prev!,
                         activeUntil: date,
                    })
          );
     };

     const handleRecurrenceTypeSelect = (type: ReminderRecurrenceType) => {
          setReminder(
               (prev) =>
                    new UpdateReminderDto({
                         ...prev!,
                         recurrenceType: type,
                         daysOfWeek: type === ReminderRecurrenceType.Monthly ? undefined : prev!.daysOfWeek,
                         daysOfMonth: type === ReminderRecurrenceType.Weekly ? undefined : prev!.daysOfMonth,
                    })
          );
     };

     const handleReminderDaysSelect = (value: number) => {
          setReminder(
               (prev) =>
                    new UpdateReminderDto({
                         ...prev!,
                         numberOfDaysToRemindBefore: value,
                    })
          );
     };

     const handleReminderConcreteDaysOfWeekSelect = (days: DayOfWeek[]) => {
          setReminder(
               (prev) =>
                    new UpdateReminderDto({
                         ...prev!,
                         daysOfWeek: days,
                    })
          );
     };

     const handleReminderConcreteDaysOfMonthSelect = (days: number[]) => {
          setReminder(
               (prev) =>
                    new UpdateReminderDto({
                         ...prev!,
                         daysOfMonth: days,
                    })
          );
     };

     const handleNameSet = (name: string) => {
          setReminder(
               (prev) =>
                    new UpdateReminderDto({
                         ...prev!,
                         name,
                    })
          );
     };

     const handleTypeSelect = (type: ReminderType) => {
          setReminder(
               (prev) =>
                    new UpdateReminderDto({
                         ...prev!,
                         type,
                         recurrenceType:
                              type === ReminderType.Regular
                                   ? (prev!.recurrenceType ?? ReminderRecurrenceType.Weekly)
                                   : undefined,
                         daysOfWeek: type === ReminderType.OneTimeEvent ? [] : prev!.daysOfWeek,
                         daysOfMonth: type === ReminderType.OneTimeEvent ? [] : prev!.daysOfMonth,
                         activeUntil: type === ReminderType.OneTimeEvent ? undefined : prev!.activeUntil,
                         occurrenceDate: type == ReminderType.Regular ? undefined : prev!.occurrenceDate,
                    })
          );
     };

     return (
          <DrawerLayout
               title={t('reminders.detailTitle')}
               isLoading={false}
               onClose={() => onClose(false)}
               onSaveAndClose={saveReminder}
          >
               {reminder === undefined ? (
                    <Box alignItems="center" justifyContent="center" width="100%">
                         <LinearProgress
                              sx={{
                                   mr: 2,
                                   ml: 2,
                                   mt: 5,
                                   bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
                                   [`& .${linearProgressClasses.bar}`]: { bgcolor: 'text.primary' },
                              }}
                         />
                    </Box>
               ) : (
                    <>
                         <Box display="flex" alignItems="center" gap={1} sx={{ mt: 1 }}>
                              <NameInput name={reminder?.name ?? ''} setName={handleNameSet} errors={errors} />

                              <ReminderTypeSelect
                                   selectedType={reminder.type}
                                   errors={errors}
                                   onSelect={handleTypeSelect}
                              />
                         </Box>
                         <FormControl fullWidth>
                              <TextField
                                   id="update-reminder-description"
                                   label={t('reminders.description')}
                                   multiline
                                   minRows={4}
                                   maxRows={10}
                                   value={reminder.description ?? ''}
                                   onChange={(e) =>
                                        setReminder(
                                             (prev) => new UpdateReminderDto({ ...prev!, description: e.target.value })
                                        )
                                   }
                                   slotProps={{
                                        input: {
                                             inputProps: { maxLength: 2000 },
                                        },
                                   }}
                              />
                         </FormControl>

                         <SectionHeader text={t('reminders.displaySettings')} headerVariant="subtitle2" />

                         {reminder.type === ReminderType.OneTimeEvent && (
                              <Box display="flex" alignItems="center" gap={1} sx={{ mt: 1 }}>
                                   <ReminderDatePicker
                                        selectedDate={reminder.occurrenceDate}
                                        label={t('reminders.occurrenceDate')}
                                        onDatePicked={handleOccurrenceDateSelect}
                                        sx={{ minWidth: '50%' }}
                                   />

                                   <ReminderDaysInput
                                        selectedValue={reminder.numberOfDaysToRemindBefore}
                                        onSelectedValueChange={handleReminderDaysSelect}
                                        errors={errors}
                                   />
                              </Box>
                         )}
                         {reminder.type == ReminderType.Regular && (
                              <Box display="flex" gap={1} sx={{ mt: 1 }}>
                                   <Box sx={{ minWidth: '40%' }} gap={1} alignItems="center">
                                        <ReminderRecurrenceTypeSelect
                                             selectedType={reminder.recurrenceType ?? ReminderRecurrenceType.Weekly}
                                             errors={errors}
                                             onSelect={handleRecurrenceTypeSelect}
                                        />
                                        <Box sx={{ mt: 1 }} gap={1} alignItems="center">
                                             <ReminderDatePicker
                                                  selectedDate={reminder.activeUntil}
                                                  label={t('reminders.activeUntilDate')}
                                                  onDatePicked={handleActiveUntilDateSelect}
                                                  sx={{ minWidth: '100%' }}
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
                    </>
               )}
          </DrawerLayout>
     );
}
