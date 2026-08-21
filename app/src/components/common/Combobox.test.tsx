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

/**
 * `secondary` exists for options whose label is not unique — two clients called "Hospoda Na
 * Rohu" told apart only by their trading name. It has to be *searchable*, not just visible:
 * a line you can read but cannot type is worse than no line at all.
 */
describe('Combobox with a secondary line', () => {
  const twins: ComboOption[] = [
    { value: 'gastro', label: 'Hospoda Na Rohu', secondary: 'Na Rohu gastro s.r.o.', group: 'Berlín' },
    { value: 'family', label: 'Hospoda Na Rohu', secondary: 'Jan Vrána', group: 'Berlín' },
    { value: 'kapr', label: 'Pivnice U Kapra', group: 'Berlín' },
  ];

  function openTwins({ collapsibleGroups = false } = {}) {
    const onChange = vi.fn();
    render(
      <MuiThemeProvider theme={theme}>
        <Combobox label="Klient" value={null} onChange={onChange} options={twins} collapsibleGroups={collapsibleGroups} />
      </MuiThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    return { onChange, input: screen.getByRole('combobox') };
  }

  it.each([['grouped headers', true], ['plain groups', false]])(
    'shows it under the label (%s)',
    (_label, collapsibleGroups) => {
      openTwins({ collapsibleGroups });

      expect(screen.getAllByText('Hospoda Na Rohu')).toHaveLength(2);
      expect(screen.getByText('Na Rohu gastro s.r.o.')).toBeInTheDocument();
      expect(screen.getByText('Jan Vrána')).toBeInTheDocument();
    },
  );

  it('picks the one whose trading name was typed', () => {
    const { onChange, input } = openTwins();

    fireEvent.change(input, { target: { value: 'vrána' } });

    // Only one of the two identically-named rows survives the query.
    expect(screen.getAllByText('Hospoda Na Rohu')).toHaveLength(1);
    fireEvent.click(screen.getByText('Jan Vrána'));
    expect(onChange).toHaveBeenCalledWith('family');
  });

  it('matches a trading name without its accents, as the label search does', () => {
    const { input } = openTwins();

    fireEvent.change(input, { target: { value: 'vrana' } });

    expect(screen.getByText('Jan Vrána')).toBeInTheDocument();
  });

  it('still matches on the label alone', () => {
    const { input } = openTwins();

    fireEvent.change(input, { target: { value: 'kapra' } });

    expect(screen.getByText('Pivnice U Kapra')).toBeInTheDocument();
    expect(screen.queryByText('Jan Vrána')).not.toBeInTheDocument();
  });
});
