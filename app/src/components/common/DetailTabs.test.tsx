// The two things this component decides: an open tab's actions land on the tab strip rather
// than under it, and a panel that carries actions still shows them when it is used somewhere
// without a tab strip. fireEvent — user-event is not a dependency of this project.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, Tab, Tabs, ThemeProvider as MuiThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { DetailTabs, TabActions } from './DetailTabs';

function Panel({ onClick }: { onClick?: () => void }) {
  return (
    <div>
      <TabActions>
        <Button onClick={onClick}>Přidat zboží</Button>
      </TabActions>
      <p>obsah panelu</p>
    </div>
  );
}

const strip = (
  <Tabs value="cenik">
    <Tab value="cenik" label="Ceník" />
    <Tab value="notes" label="Poznámky" />
  </Tabs>
);

describe('DetailTabs', () => {
  it('puts an action inside the strip, not in the tab body', () => {
    render(
      <MuiThemeProvider theme={theme}>
        <DetailTabs tabs={strip}>
          <Panel />
        </DetailTabs>
      </MuiThemeProvider>,
    );

    const slot = screen.getByTestId('tab-actions-slot');
    const button = screen.getByRole('button', { name: 'Přidat zboží' });
    expect(slot.contains(button)).toBe(true);
  });

  it('leaves the tab body to its content', () => {
    render(
      <MuiThemeProvider theme={theme}>
        <DetailTabs tabs={strip}>
          <Panel />
        </DetailTabs>
      </MuiThemeProvider>,
    );

    // The panel's own markup keeps only the content; the button moved out of it.
    const body = screen.getByText('obsah panelu').parentElement!;
    expect(body.querySelector('button')).toBeNull();
  });

  it('keeps the action wired to its panel after moving it', () => {
    const onClick = vi.fn();
    render(
      <MuiThemeProvider theme={theme}>
        <DetailTabs tabs={strip}>
          <Panel onClick={onClick} />
        </DetailTabs>
      </MuiThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Přidat zboží' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders an action in place when there is no strip above it', () => {
    // Without the fallback the button would vanish silently — the panel would look complete
    // and simply have no way to add anything.
    render(
      <MuiThemeProvider theme={theme}>
        <Panel />
      </MuiThemeProvider>,
    );

    expect(screen.getByRole('button', { name: 'Přidat zboží' })).toBeTruthy();
  });
});
