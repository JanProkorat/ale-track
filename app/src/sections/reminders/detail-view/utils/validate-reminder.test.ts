import { it, vi, expect, describe } from 'vitest';

import { validateReminder } from './validate-reminder';
import { ReminderType, CreateReminderDto, UpdateReminderDto, ReminderRecurrenceType } from '../../../../api/Client';

vi.mock('i18next', () => ({
     t: (key: string) => key,
}));

describe('validateReminder', () => {
     it('should return error when name is empty', () => {
          const dto = new CreateReminderDto({
               name: '',
               type: ReminderType.OneTimeEvent,
               numberOfDaysToRemindBefore: 1,
               occurrenceDate: new Date(),
          });

          const errors = validateReminder(dto);
          expect(errors.name).toBeDefined();
     });

     it('should return error when numberOfDaysToRemindBefore is undefined', () => {
          const dto = new CreateReminderDto({
               name: 'Test',
               type: ReminderType.OneTimeEvent,
               numberOfDaysToRemindBefore: undefined as unknown as number,
               occurrenceDate: new Date(),
          });

          const errors = validateReminder(dto);
          expect(errors.numberOfDaysToRemindBefore).toBeDefined();
     });

     it('should return no errors for valid OneTimeEvent', () => {
          const dto = new CreateReminderDto({
               name: 'Test',
               type: ReminderType.OneTimeEvent,
               numberOfDaysToRemindBefore: 3,
               occurrenceDate: new Date(),
          });

          const errors = validateReminder(dto);
          expect(Object.keys(errors)).toHaveLength(0);
     });

     it('should return error when OneTimeEvent has no occurrenceDate', () => {
          const dto = new CreateReminderDto({
               name: 'Test',
               type: ReminderType.OneTimeEvent,
               numberOfDaysToRemindBefore: 3,
               occurrenceDate: undefined,
          });

          const errors = validateReminder(dto);
          expect(errors.occurrenceDate).toBeDefined();
     });

     it('should return error when Regular has no activeUntil', () => {
          const dto = new CreateReminderDto({
               name: 'Test',
               type: ReminderType.Regular,
               numberOfDaysToRemindBefore: 3,
               recurrenceType: ReminderRecurrenceType.Weekly,
               daysOfWeek: [1],
               activeUntil: undefined,
          });

          const errors = validateReminder(dto);
          expect(errors.activeUntil).toBeDefined();
     });

     it('should return error when Regular has no recurrenceType', () => {
          const dto = new CreateReminderDto({
               name: 'Test',
               type: ReminderType.Regular,
               numberOfDaysToRemindBefore: 3,
               recurrenceType: undefined,
               activeUntil: new Date(),
          });

          const errors = validateReminder(dto);
          expect(errors.recurrenceType).toBeDefined();
     });

     it('should return error when Weekly has no daysOfWeek', () => {
          const dto = new CreateReminderDto({
               name: 'Test',
               type: ReminderType.Regular,
               numberOfDaysToRemindBefore: 3,
               recurrenceType: ReminderRecurrenceType.Weekly,
               daysOfWeek: [],
               activeUntil: new Date(),
          });

          const errors = validateReminder(dto);
          expect(errors.daysOfWeek).toBeDefined();
     });

     it('should return error when Monthly has no daysOfMonth', () => {
          const dto = new CreateReminderDto({
               name: 'Test',
               type: ReminderType.Regular,
               numberOfDaysToRemindBefore: 3,
               recurrenceType: ReminderRecurrenceType.Monthly,
               daysOfMonth: [],
               activeUntil: new Date(),
          });

          const errors = validateReminder(dto);
          expect(errors.daysOfMonth).toBeDefined();
     });

     it('should return no errors for valid Regular Weekly', () => {
          const dto = new CreateReminderDto({
               name: 'Test',
               type: ReminderType.Regular,
               numberOfDaysToRemindBefore: 3,
               recurrenceType: ReminderRecurrenceType.Weekly,
               daysOfWeek: [1, 3],
               activeUntil: new Date(),
          });

          const errors = validateReminder(dto);
          expect(Object.keys(errors)).toHaveLength(0);
     });

     it('should return no errors for valid Regular Monthly', () => {
          const dto = new CreateReminderDto({
               name: 'Test',
               type: ReminderType.Regular,
               numberOfDaysToRemindBefore: 3,
               recurrenceType: ReminderRecurrenceType.Monthly,
               daysOfMonth: [1, 15],
               activeUntil: new Date(),
          });

          const errors = validateReminder(dto);
          expect(Object.keys(errors)).toHaveLength(0);
     });

     it('should work with UpdateReminderDto as well', () => {
          const dto = new UpdateReminderDto({
               name: '',
               type: ReminderType.OneTimeEvent,
               numberOfDaysToRemindBefore: 1,
               occurrenceDate: new Date(),
          });

          const errors = validateReminder(dto);
          expect(errors.name).toBeDefined();
     });
});
