import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RouteNavButton } from './RouteNavButton';

const depot = { lat: 50.0878, lng: 14.4606 };
const stopA = { lat: 50.0831, lng: 14.5377 };
const stopB = { lat: 50.0335, lng: 14.5087 };

function open(stops: { lat: number; lng: number }[]) {
  render(<RouteNavButton depot={depot} stops={stops} />);
  fireEvent.click(screen.getByLabelText('Otevřít v navigaci'));
}

function itemHref(name: RegExp): string {
  return screen.getByRole('menuitem', { name }).getAttribute('href') ?? '';
}

describe('RouteNavButton', () => {
  it('offers both navigation targets, each opening in a new tab', () => {
    open([stopA, stopB]);

    expect(itemHref(/Mapy\.cz/)).toContain('https://mapy.com/fnc/v1/route?');
    expect(itemHref(/Google Maps/)).toContain('https://www.google.com/maps/dir/?');

    const mapy = screen.getByRole('menuitem', { name: /Mapy\.cz/ });
    expect(mapy).toHaveAttribute('target', '_blank');
    expect(mapy).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('offers no Apple Maps target — its URL scheme cannot carry the route', () => {
    open([stopA, stopB]);
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.queryByRole('menuitem', { name: /Apple/ })).toBeNull();
  });

  it('says how many stops a provider had to drop when the route exceeds its limit', () => {
    open(Array.from({ length: 12 }, (_, i) => ({ lat: 50 + i / 100, lng: 14 + i / 100 })));
    // Google takes 9 waypoints, Mapy 15 — so only Google drops stops here.
    expect(screen.getByRole('menuitem', { name: /Google Maps/ })).toHaveTextContent('Bez 3 zastávek');
    expect(screen.getByRole('menuitem', { name: /Mapy\.cz/ })).not.toHaveTextContent('Bez');
  });

  it('renders nothing without a located stop to navigate to', () => {
    const { container } = render(<RouteNavButton depot={depot} stops={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
