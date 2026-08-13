import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PointMap } from './PointMap';

// Leaflet needs a real sized viewport to build a map, so the MapContainer is
// stubbed and handed a fake map instance through the same `ref` react-leaflet
// uses. What's left is exactly what the component itself decides: placeholder
// vs. map, which controls exist, and what each one asks the map to do.
const leafletMap = {
  setView: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  invalidateSize: vi.fn(),
  scrollWheelZoom: { enable: vi.fn(), disable: vi.fn() },
};

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, ref }: { children?: ReactNode; ref?: { current: unknown } }) => {
    if (ref) ref.current = leafletMap;
    return <div data-testid="map-container">{children}</div>;
  },
  TileLayer: () => null,
  Marker: () => <div data-testid="marker" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PointMap', () => {
  it('renders the no-GPS placeholder, and no controls, without coordinates', () => {
    render(<PointMap />);

    expect(screen.getByText('Bez GPS souřadnic')).toBeInTheDocument();
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Celá obrazovka')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Zpět na bod')).not.toBeInTheDocument();
  });

  it('renders the placeholder when only one half of the pair is present', () => {
    render(<PointMap lat={50.77} />);

    expect(screen.getByText('Bez GPS souřadnic')).toBeInTheDocument();
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
  });

  it('renders a marker map with fullscreen, zoom and refocus controls', () => {
    render(<PointMap lat={50.77} lng={15.058} />);

    expect(screen.getByTestId('marker')).toBeInTheDocument();
    expect(screen.getByLabelText('Celá obrazovka')).toBeInTheDocument();
    expect(screen.getByLabelText('Přiblížit')).toBeInTheDocument();
    expect(screen.getByLabelText('Oddálit')).toBeInTheDocument();
    expect(screen.getByLabelText('Zpět na bod')).toBeInTheDocument();
    expect(screen.queryByText('Bez GPS souřadnic')).not.toBeInTheDocument();
  });

  it('refocuses on the point at the configured zoom', () => {
    render(<PointMap lat={50.77} lng={15.058} zoom={12} />);

    fireEvent.click(screen.getByLabelText('Zpět na bod'));

    expect(leafletMap.setView).toHaveBeenCalledWith([50.77, 15.058], 12);
  });

  it('zooms through the map instance', () => {
    render(<PointMap lat={50.77} lng={15.058} />);

    fireEvent.click(screen.getByLabelText('Přiblížit'));
    fireEvent.click(screen.getByLabelText('Oddálit'));

    expect(leafletMap.zoomIn).toHaveBeenCalledTimes(1);
    expect(leafletMap.zoomOut).toHaveBeenCalledTimes(1);
  });

  it('requests fullscreen on the map wrapper, and exits when already fullscreen', () => {
    const requestFullscreen = vi.fn();
    const exitFullscreen = vi.fn();
    Element.prototype.requestFullscreen = requestFullscreen;
    document.exitFullscreen = exitFullscreen;

    render(<PointMap lat={50.77} lng={15.058} />);
    fireEvent.click(screen.getByLabelText('Celá obrazovka'));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(exitFullscreen).not.toHaveBeenCalled();

    // With a fullscreen element in play the same button collapses instead.
    Object.defineProperty(document, 'fullscreenElement', { value: document.body, configurable: true });
    fireEvent.click(screen.getByLabelText('Celá obrazovka'));
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
  });
});
