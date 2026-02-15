import { screen, fireEvent } from '@testing-library/react';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { renderWithProviders } from 'src/test/test-utils';

import { MapDialog } from './map-dialog';

// -------------------------------------------------------------------

vi.mock('./map-view', () => ({
    MapView: ({ lat, lng, isFullscreen }: any) => (
        <div data-testid="map-view" data-lat={lat} data-lng={lng} data-fullscreen={isFullscreen} />
    ),
}));

vi.mock('@mui/icons-material/Close', () => ({
    default: () => <span data-testid="close-icon" />,
}));

describe('MapDialog', () => {
    const defaultProps = {
        open: true,
        onClose: vi.fn(),
        lat: 50.075,
        lng: 14.437,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders MapView when open', () => {
        renderWithProviders(<MapDialog {...defaultProps} />);
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    it('passes lat and lng to MapView', () => {
        renderWithProviders(<MapDialog {...defaultProps} />);
        const mapView = screen.getByTestId('map-view');
        expect(mapView).toHaveAttribute('data-lat', '50.075');
        expect(mapView).toHaveAttribute('data-lng', '14.437');
    });

    it('passes isFullscreen based on open prop', () => {
        renderWithProviders(<MapDialog {...defaultProps} />);
        const mapView = screen.getByTestId('map-view');
        expect(mapView).toHaveAttribute('data-fullscreen', 'true');
    });

    it('renders close button', () => {
        renderWithProviders(<MapDialog {...defaultProps} />);
        expect(screen.getByTestId('close-icon')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        renderWithProviders(<MapDialog {...defaultProps} />);
        const closeButton = screen.getByTestId('close-icon').closest('button')!;
        fireEvent.click(closeButton);
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('does not render content when closed', () => {
        renderWithProviders(<MapDialog {...defaultProps} open={false} />);
        expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
    });
});
