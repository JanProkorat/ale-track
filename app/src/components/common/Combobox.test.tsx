import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { Combobox, type ComboOption } from './Combobox';

const options: ComboOption[] = [
  { value: 'a', label: 'Adam', group: 'Berlín' },
  { value: 'b', label: 'Bára', group: 'Berlín' },
  { value: 'c', label: 'Cyril', group: 'Lipsko' },
];

function open(onChange = vi.fn()) {
  render(
    <MuiThemeProvider theme={theme}>
      <Combobox label="Klient" value={null} onChange={onChange} options={options} collapsibleGroups />
    </MuiThemeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /open/i }));
  return { onChange, input: screen.getByRole('combobox') };
}

describe('Combobox with collapsibleGroups', () => {
  it('lists every group header with its option count', () => {
    open();
    expect(screen.getByText('Berlín')).toBeInTheDocument();
    expect(screen.getByText('Lipsko')).toBeInTheDocument();
    expect(screen.getByText('Adam')).toBeInTheDocument();
  });

  it('hides a group’s options when its header is clicked, and shows them again', () => {
    open();
    fireEvent.click(screen.getByText('Berlín'));
    expect(screen.queryByText('Adam')).not.toBeInTheDocument();
    expect(screen.queryByText('Bára')).not.toBeInTheDocument();
    // The other group is untouched.
    expect(screen.getByText('Cyril')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Berlín'));
    expect(screen.getByText('Adam')).toBeInTheDocument();
  });

  it('does not select anything when a header is clicked', () => {
    const { onChange } = open();
    fireEvent.click(screen.getByText('Berlín'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reveals matches inside a collapsed group while searching', () => {
    const { input } = open();
    fireEvent.click(screen.getByText('Berlín'));
    expect(screen.queryByText('Adam')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'ada' } });
    expect(screen.getByText('Adam')).toBeInTheDocument();
    expect(screen.queryByText('Cyril')).not.toBeInTheDocument();

    // Clearing the query restores the collapse the search overrode.
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.queryByText('Adam')).not.toBeInTheDocument();
  });

  it('drops a header once the search filters away all of its options', () => {
    const { input } = open();
    fireEvent.change(input, { target: { value: 'cyr' } });
    expect(screen.queryByText('Berlín')).not.toBeInTheDocument();
    expect(screen.getByText('Lipsko')).toBeInTheDocument();
  });

  it('still selects a normal option', () => {
    const { onChange } = open();
    fireEvent.click(screen.getByText('Cyril'));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('skips headers when arrowing down from the input', () => {
    const { input } = open();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByText('Adam').closest('li')).toHaveClass('Mui-focused');
  });
});
