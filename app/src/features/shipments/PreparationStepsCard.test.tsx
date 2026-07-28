// The preparation checklist on the vývoz detail. Tick-only by design, so what this card decides
// is: what it shows when there is nothing to show, what progress it reports, and when the boxes
// may be touched at all.

import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { OutgoingShipmentPreparationStepDto } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { PreparationStepsCard } from './PreparationStepsCard';

function step(label: string, order: number, isDone = false): OutgoingShipmentPreparationStepDto {
  return new OutgoingShipmentPreparationStepDto({ id: `step-${order}`, order, label, isDone });
}

function renderCard(
  steps: OutgoingShipmentPreparationStepDto[],
  { editable = true, onToggle = vi.fn() } = {},
) {
  render(
    <MuiThemeProvider theme={theme}>
      <PreparationStepsCard steps={steps} editable={editable} onToggle={onToggle} />
    </MuiThemeProvider>,
  );
  return onToggle;
}

describe('PreparationStepsCard', () => {
  it('renders nothing when the shipment has no checklist', () => {
    // Steps can only be added in the editor, so an empty card would be a dead end.
    const { container } = render(
      <MuiThemeProvider theme={theme}>
        <PreparationStepsCard steps={[]} editable onToggle={vi.fn()} />
      </MuiThemeProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('lists the steps in their stored order, not the array order', () => {
    renderCard([step('Zkontrolovat doklady', 2), step('Naložit vratky', 1)]);

    const labels = screen.getAllByText(/Naložit vratky|Zkontrolovat doklady/);
    expect(labels.map((el) => el.textContent)).toEqual(['Naložit vratky', 'Zkontrolovat doklady']);
  });

  it('reports progress while the list is unfinished', () => {
    renderCard([step('Naložit vratky', 1, true), step('Zkontrolovat doklady', 2), step('Umýt vůz', 3)]);

    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.queryByText('Hotovo')).not.toBeInTheDocument();
  });

  it('swaps the counter for a done pill once every step is ticked', () => {
    renderCard([step('Naložit vratky', 1, true), step('Zkontrolovat doklady', 2, true)]);

    expect(screen.getByText('Hotovo')).toBeInTheDocument();
    expect(screen.queryByText('2/2')).not.toBeInTheDocument();
  });

  it('reflects a ticked step in its checkbox', () => {
    renderCard([step('Naložit vratky', 1, true), step('Zkontrolovat doklady', 2)]);

    expect(screen.getByLabelText('Naložit vratky')).toBeChecked();
    expect(screen.getByLabelText('Zkontrolovat doklady')).not.toBeChecked();
  });

  it('reports which step was ticked, and to what', () => {
    const onToggle = renderCard([step('Naložit vratky', 1), step('Zkontrolovat doklady', 2)]);

    fireEvent.click(screen.getByLabelText('Zkontrolovat doklady'));

    expect(onToggle).toHaveBeenCalledWith('step-2', true);
  });

  it('reports unticking too', () => {
    const onToggle = renderCard([step('Naložit vratky', 1, true)]);

    fireEvent.click(screen.getByLabelText('Naložit vratky'));

    expect(onToggle).toHaveBeenCalledWith('step-1', false);
  });

  it('disables the boxes when the shipment may no longer be changed', () => {
    // A delivered or cancelled run is a historical record; the server rejects the write, so the
    // control must not invite it.
    const onToggle = renderCard([step('Naložit vratky', 1)], { editable: false });

    const box = screen.getByLabelText('Naložit vratky');
    expect(box).toBeDisabled();

    fireEvent.click(box);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
