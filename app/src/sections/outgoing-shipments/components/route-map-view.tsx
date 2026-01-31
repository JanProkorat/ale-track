import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';

import L from 'leaflet';
import { useRef, useState, useEffect } from 'react';

import { COMPANY_ADDRESS } from '../../../utils/load-company-address';

import type { AddressDto } from '../../../api/Client';
import type { RouteStop } from './shipment-route-planner';

// Extend Leaflet types for the routing machine
declare module 'leaflet' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Routing {
    interface ControlOptions {
      waypoints: L.LatLng[];
      routeWhileDragging?: boolean;
      addWaypoints?: boolean;
      draggableWaypoints?: boolean;
      show?: boolean;
      lineOptions?: {
        styles?: Array<{ weight: number }>;
      };
      router?: any;
    }

    function control(options: ControlOptions): Control;

    interface Control extends L.Control {
      remove(): this;
    }

    function osrmv1(options?: { serviceUrl?: string }): any;
  }
}

type RouteMapProps = {
  type: 'create' | 'update';
  stops: RouteStop[];
  isFullscreen: boolean;
  onFullScreenToggle: (isFullscreen: boolean) => void;
};

export default function RouteMapView({ type, stops, isFullscreen, onFullScreenToggle }: RouteMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const routingRef = useRef<any>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const companyAddress = COMPANY_ADDRESS;

  const [addressesToDisplay, setAddressesToDisplay] = useState<AddressDto[]>([]);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `.leaflet-routing-container { display: none !important; }`;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    setAddressesToDisplay([
      companyAddress,
      ...stops
        .map((stop) => stop.selectedAddress)
        .filter(address => address !== undefined),
      companyAddress,
    ]);
  }, [companyAddress, stops])

  // Helper function to create numbered marker icon
  const createNumberedIcon = (number: number) => L.divIcon({
    className: 'custom-numbered-icon',
    html: `<div style="
        background-color: #1976d2;
        color: white;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        border: 2px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      ">${number}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  // Helper function to create start/end marker icon
  const createStartEndIcon = (label: string) => L.divIcon({
    className: 'custom-start-end-icon',
    html: `<div style="
        background-color: #2e7d32;
        color: white;
        border-radius: 50%;
        width: 35px;
        height: 35px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 12px;
        border: 2px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      ">${label}</div>`,
    iconSize: [35, 35],
    iconAnchor: [17.5, 17.5],
  });

  useEffect(() => {
    if (addressesToDisplay.length === 0) {
      return undefined;
    }

    // Use different container IDs for normal and fullscreen views
    const containerId = type + (isFullscreen ? '-fullscreen' : '');

    // Store current zoom and center if map exists
    const savedZoom = mapRef.current?.getZoom();
    const savedCenter = mapRef.current?.getCenter();

    if (!mapRef.current) {
      mapRef.current = L.map(containerId).setView(
        [
          addressesToDisplay[0].latitude ?? 0,
          addressesToDisplay[0].longitude ?? 0,
        ],
        8
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapRef.current);

      // Add fullscreen control
      if (!isFullscreen) {
        const FullscreenControl = L.Control.extend({
          onAdd: () => {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            const button = L.DomUtil.create('button', '', container);

            // Add fullscreen icon as SVG
            button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor">
              <path d="M0 0h24v24H0z" fill="none"/>
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
          `;
            button.title = 'Zobrazit mapu přes celou obrazovku';
            button.style.cssText = `
            background: white;
            border: none;
            padding: 5px;
            cursor: pointer;
            color: rgba(0, 0, 0, 0.87);
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
          `;

            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', () => {
              onFullScreenToggle(true);
            });

            return container;
          },
        });

        const fullscreenControl = new FullscreenControl({ position: 'topright' });
        fullscreenControl.addTo(mapRef.current);
      }
    }

    // Remove previous route if exists
    if (routingRef.current) {
      routingRef.current.remove();
    }

    // Remove previous markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Check if first and last addresses are the same
    const firstAddress = addressesToDisplay[0];
    const lastAddress = addressesToDisplay[addressesToDisplay.length - 1];
    const isSameStartEnd =
      firstAddress.latitude === lastAddress.latitude &&
      firstAddress.longitude === lastAddress.longitude;

    // Add numbered markers
    addressesToDisplay.forEach((address, index) => {
      let marker: L.Marker;

      if (index === 0 && isSameStartEnd) {
        // First marker when start and end are the same
        marker = L.marker(
          [address.latitude ?? 0, address.longitude ?? 0],
          { icon: createStartEndIcon('S') }
        ).addTo(mapRef.current!);
      } else if (index === addressesToDisplay.length - 1 && isSameStartEnd) {
        // Skip the last marker if it's the same as the first
        return;
      } else {
        // Regular numbered marker
        marker = L.marker(
          [address.latitude ?? 0, address.longitude ?? 0],
          { icon: createNumberedIcon(index) }
        ).addTo(mapRef.current!);
      }

      markersRef.current.push(marker);
    });

    routingRef.current = (L as any).Routing.control({
      waypoints: addressesToDisplay.map((c) =>
        L.latLng(c.latitude ?? 0, c.longitude ?? 0)
      ),
      routeWhileDragging: false,
      addWaypoints: true,
      draggableWaypoints: false,
      show: false,
      lineOptions: {
        styles: [{ weight: 5 }],
      },
      router: (L as any).Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
      }),
    }).addTo(mapRef.current);

    // Restore saved zoom and center after routing is added
    if (savedZoom && savedCenter) {
      // Use a small timeout to ensure the routing control has finished its initial fitBounds
      setTimeout(() => {
        if (mapRef.current && savedZoom && savedCenter) {
          mapRef.current.setView(savedCenter, savedZoom);
        }
      }, 100);
    }

    return () => {
      routingRef.current?.remove();
      markersRef.current.forEach(marker => marker.remove());
    };
  }, [addressesToDisplay, isFullscreen, onFullScreenToggle, type]);

  // Use different container IDs for normal and fullscreen views
  const containerId = type + (isFullscreen ? '-fullscreen' : '');

  return <div id={containerId} style={{ width: '100%', height: '100%', borderRadius: 12 }} />;
}