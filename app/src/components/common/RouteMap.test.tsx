import { type ReactNode } from 'react';
import { render, screen, fireEvent, waitForElementToBeRemoved, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Leaflet needs a real sized viewport to build a map, so react-leaflet is stubbed the
// same way PointMap.test.tsx does it. What's left is what RouteMap itself decides —
// here: the trip stats and the panel that unfolds from them.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, ref }: { children?: ReactNode; ref?: { current: unknown } }) => {
    if (ref) ref.current = { zoomIn: vi.fn(), zoomOut: vi.fn(), fitBounds: vi.fn(), invalidateSize: vi.fn() };
    return <div data-testid="map-container">{children}</div>;
  },
  TileLayer: () => null,
  Marker: ({ children }: { children?: ReactNode }) => <div data-testid="marker">{children}</div>,
  Polyline: () => null,
  Tooltip: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

// The road route is an OSRM fetch; rejecting it leaves the component on its
// straight-line fallback, which is all the stats need to render.
vi.mock('src/lib/geo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/lib/geo')>()),
  fetchRoadRoute: vi.fn().mockRejectedValue(new Error('offline in tests')),
}));

const { RouteMap } = await import('./RouteMap');

const start = { lat: 50.84, lng: 14.83, name: 'Sklad AleTrack' };
const stops = [
  { lat: 50.89, lng: 14.8, label: 'Restaurace B' },
  { lat: 50.77, lng: 15.05, label: 'Hospoda C' },
];

function renderMap(overlay?: ReactNode, opts: { busy?: boolean } = {}) {
  return render(
    <RouteMap
      stops={stops}
      start={start}
      end={start}
      overlay={overlay}
      overlayShowLabel="Zobrazit zastávky"
      overlayHideLabel="Skrýt zastávky"
      busy={opts.busy}
    />,
  );
}

describe('RouteMap — the panel that unfolds from the trip stats', () => {
  it('shows the trip stats, and no chevron, when no panel was handed over', () => {
    renderMap();

    expect(screen.getByText('VZDÁLENOST')).toBeInTheDocument();
    expect(screen.getByText('ZASTÁVEK')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zobrazit zastávky' })).not.toBeInTheDocument();
  });

  it('keeps the panel folded away until the chevron is used', () => {
    renderMap(<div>Přehled zastávek</div>);

    // The route is what the map is opened for; the list is the follow-up question.
    expect(screen.queryByText('Přehled zastávek')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zobrazit zastávky' })).toBeInTheDocument();
  });

  it('unfolds the panel on the chevron and folds it back again', async () => {
    renderMap(<div>Přehled zastávek</div>);

    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit zastávky' }));
    expect(screen.getByText('Přehled zastávek')).toBeInTheDocument();

    // The same control closes it, and says so.
    fireEvent.click(screen.getByRole('button', { name: 'Skrýt zastávky' }));
    // Content inside a Collapse stays mounted while it animates out, so this waits for
    // the removal rather than asserting it on the next tick (see app/CLAUDE.md).
    await waitForElementToBeRemoved(() => screen.queryByText('Přehled zastávek'));
  });

  // Guards the animation itself: a panel that vanished on the same tick as the click
  // would pass the fold-back test above just as well, so this pins that it is still
  // there mid-slide and only then goes.
  it('slides the panel out rather than removing it instantly', async () => {
    renderMap(<div>Přehled zastávek</div>);

    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit zastávky' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skrýt zastávky' }));

    expect(screen.getByText('Přehled zastávek')).toBeInTheDocument();
    await waitForElementToBeRemoved(() => screen.queryByText('Přehled zastávek'));
  });

  // The panel is bounded so its bottom edge clears the map by the same inset as its left edge.
  // It clips rather than scrolls, because what scrolls is the panel's own list — that is what
  // lets a card keep its header out of the scrollport.
  it('bounds the panel and leaves the scrolling to it', () => {
    renderMap(<div data-testid="panel">Přehled zastávek</div>);
    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit zastávky' }));

    const wrapper = screen.getByTestId('panel').parentElement as HTMLElement;
    const style = getComputedStyle(wrapper);
    expect(style.maxHeight).not.toBe('');
    expect(style.maxHeight).not.toBe('none');
    // Not `auto`: the wrapper must not be the scroller.
    expect(style.overflow).not.toBe('auto');
    expect(style.display).toBe('flex');
  });

  it('reports its state to assistive tech rather than only rotating the chevron', () => {
    renderMap(<div>Přehled zastávek</div>);

    const toggle = screen.getByRole('button', { name: 'Zobrazit zastávky' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Skrýt zastávky' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('counts the located stops in the stats, panel or no panel', () => {
    renderMap(<div>Přehled zastávek</div>);

    const stats = screen.getByText('ZASTÁVEK').parentElement as HTMLElement;
    expect(within(stats).getByText('2')).toBeInTheDocument();
  });
});

// Changing the stops means a new road route, and the drawn line falls back to a straight one until
// OSRM answers. Under an edit the operator did not initiate that redraw reads as a flicker, so the
// map says it is catching up instead.
describe('RouteMap — the veil while the route is catching up', () => {
  it('is absent by default', () => {
    renderMap();

    expect(screen.queryByTestId('route-map-busy')).not.toBeInTheDocument();
  });

  it('names what it is waiting for', () => {
    renderMap(undefined, { busy: true });

    expect(screen.getByTestId('route-map-busy')).toBeInTheDocument();
    expect(screen.getByText('Přepočítávám trasu…')).toBeInTheDocument();
  });

  it('announces itself to assistive tech rather than only dimming', () => {
    renderMap(undefined, { busy: true });

    const veil = screen.getByTestId('route-map-busy');
    expect(veil).toHaveAttribute('role', 'status');
    expect(veil).toHaveAttribute('aria-live', 'polite');
  });

  // The reorder controls live in the stop list, so a second nudge must not be swallowed by the
  // veil that the first one raised.
  it('swallows no clicks, and stays under the stop list', () => {
    renderMap(<div>Přehled zastávek</div>, { busy: true });

    const veil = screen.getByTestId('route-map-busy');
    expect(getComputedStyle(veil).pointerEvents).toBe('none');
    // 900 is below the overlay column's own 1000.
    expect(Number(getComputedStyle(veil).zIndex)).toBeLessThan(1000);
  });

  it('leaves the stop list reachable underneath it', () => {
    renderMap(<div>Přehled zastávek</div>, { busy: true });
    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit zastávky' }));

    expect(screen.getByText('Přehled zastávek')).toBeInTheDocument();
  });
});
