import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, fireEvent, render as baseRender } from 'src/test/test-utils';

import { ContactsForm } from './contacts-form';
import { ContactType } from '../../../../api/Client';

import type { CreateClientContactDto } from '../../../../api/Client';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Stable t reference
const mockT = (key: string) => key;
vi.mock('react-i18next', async (importOriginal) => {
     const actual = (await importOriginal()) as Record<string, unknown>;
     return {
          ...actual,
          useTranslation: () => ({ t: mockT }),
     };
});

// Mock minimal-shared/utils (partial)
vi.mock('minimal-shared/utils', async (importOriginal) => {
     const actual = (await importOriginal()) as Record<string, unknown>;
     return {
          ...actual,
          varAlpha: () => 'rgba(0,0,0,0.16)',
     };
});

// --- Test data ---
const mockContact: CreateClientContactDto = {
     type: ContactType.Email,
     description: 'Work',
     value: 'test@example.com',
} as CreateClientContactDto;

const mockPhoneContact: CreateClientContactDto = {
     type: ContactType.Phone,
     description: 'Mobile',
     value: '+420 111 222 333',
} as CreateClientContactDto;

// --- Default props ---
const mockOnContactsChanged = vi.fn();

describe('ContactsForm', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     // --- Empty state ---
     it('should show empty state when no contacts exist', () => {
          render(<ContactsForm selectedContacts={[]} onContactsChanged={mockOnContactsChanged} />);

          expect(screen.getByText('clients.contacts.noDataTitle')).toBeInTheDocument();
          expect(screen.getByText('clients.contacts.noDataMessage')).toBeInTheDocument();
     });

     it('should show "new" button in empty state', () => {
          render(<ContactsForm selectedContacts={[]} onContactsChanged={mockOnContactsChanged} />);

          expect(screen.getByRole('button', { name: /clients\.contacts\.new/i })).toBeInTheDocument();
     });

     // --- Add contact ---
     it('should call onContactsChanged with a new email contact when "new" button is clicked', async () => {
          const user = userEvent.setup();

          render(<ContactsForm selectedContacts={[]} onContactsChanged={mockOnContactsChanged} />);

          await user.click(screen.getByRole('button', { name: /clients\.contacts\.new/i }));

          expect(mockOnContactsChanged).toHaveBeenCalledWith([
               expect.objectContaining({
                    type: ContactType.Email,
                    description: '',
                    value: '',
               }),
          ]);
     });

     // --- Display contacts ---
     it('should render contact fields when contacts exist', () => {
          render(<ContactsForm selectedContacts={[mockContact]} onContactsChanged={mockOnContactsChanged} />);

          // Description field
          const descriptionInput = screen.getByLabelText('clients.contacts.description');
          expect(descriptionInput).toHaveValue('Work');

          // Value field (email type → label is clients.contacts.email)
          const valueInput = screen.getByLabelText('clients.contacts.email');
          expect(valueInput).toHaveValue('test@example.com');
     });

     it('should render phone label for phone contact type', () => {
          render(<ContactsForm selectedContacts={[mockPhoneContact]} onContactsChanged={mockOnContactsChanged} />);

          const valueInput = screen.getByLabelText('clients.contacts.phone');
          expect(valueInput).toHaveValue('+420 111 222 333');
     });

     // --- Edit contact ---
     it('should call onContactsChanged when description is changed', () => {
          render(<ContactsForm selectedContacts={[mockContact]} onContactsChanged={mockOnContactsChanged} />);

          const descriptionInput = screen.getByLabelText('clients.contacts.description');
          fireEvent.change(descriptionInput, { target: { value: 'Personal' } });

          expect(mockOnContactsChanged).toHaveBeenCalledWith([expect.objectContaining({ description: 'Personal' })]);
     });

     it('should call onContactsChanged when value is changed', () => {
          render(<ContactsForm selectedContacts={[mockContact]} onContactsChanged={mockOnContactsChanged} />);

          const valueInput = screen.getByLabelText('clients.contacts.email');
          fireEvent.change(valueInput, { target: { value: 'new@email.com' } });

          expect(mockOnContactsChanged).toHaveBeenCalledWith([expect.objectContaining({ value: 'new@email.com' })]);
     });

     // --- Remove contact ---
     it('should call onContactsChanged without the removed contact when delete is clicked', async () => {
          const user = userEvent.setup();

          render(
               <ContactsForm
                    selectedContacts={[mockContact, mockPhoneContact]}
                    onContactsChanged={mockOnContactsChanged}
               />
          );

          // Delete buttons are the error-colored IconButtons
          const deleteButtons = document.querySelectorAll('.MuiIconButton-colorError');
          expect(deleteButtons.length).toBe(2);

          // Remove the first contact
          await user.click(deleteButtons[0] as HTMLElement);

          expect(mockOnContactsChanged).toHaveBeenCalledWith([
               expect.objectContaining({ type: ContactType.Phone, value: '+420 111 222 333' }),
          ]);
     });

     // --- Multiple contacts ---
     it('should render multiple contacts', () => {
          render(
               <ContactsForm
                    selectedContacts={[mockContact, mockPhoneContact]}
                    onContactsChanged={mockOnContactsChanged}
               />
          );

          expect(screen.getByLabelText('clients.contacts.email')).toHaveValue('test@example.com');
          expect(screen.getByLabelText('clients.contacts.phone')).toHaveValue('+420 111 222 333');
     });

     // --- Validation errors ---
     it('should show validation error indicator on value field', () => {
          render(
               <ContactsForm
                    selectedContacts={[mockContact]}
                    onContactsChanged={mockOnContactsChanged}
                    validationErrors={{ 0: { value: true } }}
               />
          );

          // The value input should have aria-invalid=true when error is set
          const valueInput = screen.getByLabelText('clients.contacts.email');
          expect(valueInput).toHaveAttribute('aria-invalid', 'true');
     });

     it('should show type validation error text', () => {
          render(
               <ContactsForm
                    selectedContacts={[mockContact]}
                    onContactsChanged={mockOnContactsChanged}
                    validationErrors={{ 0: { type: true } }}
               />
          );

          expect(screen.getByText('common.required')).toBeInTheDocument();
     });
});
