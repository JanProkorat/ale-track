// The checklist as written in the vývoz editor. The card owns adding, rewording, reordering and
// removing steps; what it must never do is lose the `id` of a step that already exists on the
// server, because that ID is what keeps the tick made on the detail screen.

import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { theme } from 'src/theme/theme';
import { PreparationStepsEditor } from './PreparationStepsEditor';
import { newDraftStep, type DraftStep } from './preparationStepModel';

function renderEditor(steps: DraftStep[], { disabled = false } = {}) {
  const onChange = vi.fn();
  render(
    <MuiThemeProvider theme={theme}>
      <PreparationStepsEditor steps={steps} onChange={onChange} disabled={disabled} />
    </MuiThemeProvider>,
  );
  return onChange;
}

const stored = (id: string, label: string): DraftStep => ({ key: id, id, label });

describe('PreparationStepsEditor', () => {
  it('invites the first step when the list is empty', () => {
    renderEditor([]);

    expect(screen.getByText('Zatím žádné položky')).toBeInTheDocument();
  });

  it('adds a typed step', () => {
    const onChange = renderEditor([]);

    fireEvent.change(screen.getByPlaceholderText('Nová položka…'), { target: { value: 'Umýt vůz' } });
    fireEvent.click(screen.getByLabelText('Přidat položku'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const added = onChange.mock.calls[0][0] as DraftStep[];
    expect(added).toHaveLength(1);
    expect(added[0].label).toBe('Umýt vůz');
    expect(added[0].id).toBeUndefined();
  });

  it('adds on Enter, so the list can be typed without reaching for the button', () => {
    const onChange = renderEditor([]);

    const input = screen.getByPlaceholderText('Nová položka…');
    fireEvent.change(input, { target: { value: 'Umýt vůz' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect((onChange.mock.calls[0][0] as DraftStep[])[0].label).toBe('Umýt vůz');
  });

  it('refuses a blank step', () => {
    const onChange = renderEditor([]);

    fireEvent.change(screen.getByPlaceholderText('Nová položka…'), { target: { value: '   ' } });
    expect(screen.getByLabelText('Přidat položku')).toBeDisabled();

    fireEvent.keyDown(screen.getByPlaceholderText('Nová položka…'), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the server ID when a stored step is reworded', () => {
    const onChange = renderEditor([stored('step-1', 'Naložit vratky')]);

    fireEvent.change(screen.getByLabelText('Položka 1'), { target: { value: 'Naložit vratky a přepravky' } });

    const next = onChange.mock.calls[0][0] as DraftStep[];
    expect(next[0]).toMatchObject({ id: 'step-1', label: 'Naložit vratky a přepravky' });
  });

  it('keeps the server IDs when steps are reordered', () => {
    const onChange = renderEditor([stored('step-1', 'Naložit vratky'), stored('step-2', 'Umýt vůz')]);

    fireEvent.click(screen.getAllByLabelText('Posunout nahoru')[1]);

    const next = onChange.mock.calls[0][0] as DraftStep[];
    expect(next.map((s) => s.id)).toEqual(['step-2', 'step-1']);
  });

  it('cannot move the ends of the list past themselves', () => {
    renderEditor([stored('step-1', 'Naložit vratky'), stored('step-2', 'Umýt vůz')]);

    expect(screen.getAllByLabelText('Posunout nahoru')[0]).toBeDisabled();
    expect(screen.getAllByLabelText('Posunout dolů')[1]).toBeDisabled();
  });

  it('removes the step asked for and no other', () => {
    const onChange = renderEditor([stored('step-1', 'Naložit vratky'), stored('step-2', 'Umýt vůz')]);

    fireEvent.click(screen.getByLabelText('Odebrat položku 1'));

    expect((onChange.mock.calls[0][0] as DraftStep[]).map((s) => s.id)).toEqual(['step-2']);
  });

  it('locks every control on a finished shipment', () => {
    renderEditor([stored('step-1', 'Naložit vratky')], { disabled: true });

    expect(screen.getByLabelText('Položka 1')).toBeDisabled();
    expect(screen.getByLabelText('Odebrat položku 1')).toBeDisabled();
    expect(screen.getByPlaceholderText('Nová položka…')).toBeDisabled();
    expect(screen.getByLabelText('Přidat položku')).toBeDisabled();
  });

  it('titles the card Checklist and labels no individual row', () => {
    // The rows are notes to check off, not numbered steps: a floating "Krok N" over each one
    // pushed the note itself into second place.
    renderEditor([stored('step-1', 'Rudlík'), stored('step-2', 'Klíče')]);

    expect(screen.getByText('Checklist')).toBeInTheDocument();
    expect(screen.queryByText('Krok 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Krok 2')).not.toBeInTheDocument();
  });

  it('gives each new step a distinct local key, so typing does not collide', () => {
    // Keys are React's identity for the rows; two steps sharing one would swap inputs mid-typing.
    expect(newDraftStep('a').key).not.toBe(newDraftStep('b').key);
  });
});
