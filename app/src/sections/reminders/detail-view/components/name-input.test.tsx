import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, fireEvent } from 'src/test/test-utils';

import { NameInput } from './name-input';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockSetName = vi.fn();

describe('NameInput', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <NameInput name="" setName={mockSetName} errors={{}} />
        );

        expect(screen.getAllByText('reminders.name')[0]).toBeInTheDocument();
    });

    it('should display the current name value', () => {
        render(
            <NameInput name="My Reminder" setName={mockSetName} errors={{}} />
        );

        expect(screen.getByDisplayValue('My Reminder')).toBeInTheDocument();
    });

    it('should call setName when input changes', () => {
        render(
            <NameInput name="" setName={mockSetName} errors={{}} />
        );

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'New Name' } });

        expect(mockSetName).toHaveBeenCalledWith('New Name');
    });

    it('should show error state when errors.name is set', () => {
        render(
            <NameInput name="test" setName={mockSetName} errors={{ name: 'Required' }} />
        );

        const label = screen.getAllByText('reminders.name')[0];
        expect(label).toHaveClass('Mui-error');
    });
});
