import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from 'src/layout/AppShell';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from 'src/pages/LoginPage';
import { DashboardPage } from 'src/pages/DashboardPage';
import { ModulePlaceholder } from 'src/pages/ModulePlaceholder';
import { VehiclesPage } from 'src/features/vehicles/VehiclesPage';
import { UsersPage } from 'src/features/users/UsersPage';
import { InventoryPage } from 'src/features/inventory/InventoryPage';
import { DriversPage } from 'src/features/drivers/DriversPage';
import { BreweriesPage } from 'src/features/breweries/BreweriesPage';
import { LOGIN_PATH, PATHS } from './paths';

const placeholder = (eyebrow: string, title: string, phase: string) => (
  <ModulePlaceholder eyebrow={eyebrow} title={title} phase={phase} />
);

export const router = createBrowserRouter([
  { path: LOGIN_PATH, element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: PATHS.orders, element: placeholder('Prodej', 'Objednávky', 'P4') },
          { path: PATHS.shipments, element: placeholder('Prodej', 'Vývozy', 'P7') },
          { path: PATHS.deliveries, element: placeholder('Sklad', 'Dovozy zboží', 'P8') },
          { path: PATHS.inventory, element: <InventoryPage /> },
          { path: PATHS.breweries, element: <BreweriesPage /> },
          { path: PATHS.clients, element: placeholder('Evidence', 'Klienti', 'P6') },
          { path: PATHS.drivers, element: <DriversPage /> },
          { path: PATHS.vehicles, element: <VehiclesPage /> },
          { path: PATHS.users, element: <UsersPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to={PATHS.dashboard} replace /> },
]);
