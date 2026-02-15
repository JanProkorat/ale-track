import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, fireEvent } from 'src/test/test-utils';

import { ColorPicker } from './color-picker';

const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

vi.mock('../iconify', () => ({
    Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
}));

vi.mock('react-colorful', () => ({
    HexColorPicker: ({ color, onChange }: { color: string; onChange: (c: string) => void }) => (
        <div data-testid="hex-color-picker">
            <span>{color}</span>
            <button onClick={() => onChange('#ff0000')}>pickColor</button>
        </div>
    ),
}));

const mockOnChange = vi.fn();

describe('ColorPicker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the color input label', () => {
        render(<ColorPicker color="#000000" errors={{}} onChange={mockOnChange} />);

        expect(screen.getAllByText('breweries.color').length).toBeGreaterThan(0);
    });

    it('should render the input with current color value', () => {
        render(<ColorPicker color="#abcdef" errors={{}} onChange={mockOnChange} />);

        const input = screen.getByRole('textbox');
        expect(input).toHaveValue('#abcdef');
    });

    it('should render pen icon adornment', () => {
        render(<ColorPicker color="#000000" errors={{}} onChange={mockOnChange} />);

        expect(screen.getByText('solar:pen-bold')).toBeInTheDocument();
    });

    it('should show error message when color error exists', () => {
        render(<ColorPicker color="" errors={{ color: 'Color is required' }} onChange={mockOnChange} />);

        expect(screen.getByText('Color is required')).toBeInTheDocument();
    });

    it('should not show error message when no color error', () => {
        render(<ColorPicker color="#000000" errors={{}} onChange={mockOnChange} />);

        expect(screen.queryByText('Color is required')).not.toBeInTheDocument();
    });

    it('should open popover when input is focused', () => {
        render(<ColorPicker color="#000000" errors={{}} onChange={mockOnChange} />);

        const input = screen.getByRole('textbox');
        fireEvent.focus(input);

        expect(screen.getByTestId('hex-color-picker')).toBeInTheDocument();
    });

    it('should pass current color to HexColorPicker', () => {
        render(<ColorPicker color="#123456" errors={{}} onChange={mockOnChange} />);

        const input = screen.getByRole('textbox');
        fireEvent.focus(input);

        expect(screen.getByText('#123456')).toBeInTheDocument();
    });

    it('should call onChange when color is picked', () => {
        render(<ColorPicker color="#000000" errors={{}} onChange={mockOnChange} />);

        const input = screen.getByRole('textbox');
        fireEvent.focus(input);

        screen.getByText('pickColor').click();

        expect(mockOnChange).toHaveBeenCalledWith('#ff0000');
    });

    it('should render placeholder text', () => {
        render(<ColorPicker color="" errors={{}} onChange={mockOnChange} />);

        const input = screen.getByRole('textbox');
        expect(input).toHaveAttribute('placeholder', 'drivers.color');
    });
});
