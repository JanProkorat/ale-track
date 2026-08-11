import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from 'src/layout/AppShell';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from 'src/pages/LoginPage';
import { DashboardPage } from 'src/pages/DashboardPage';
import { VehiclesPage } from 'src/features/vehicles/VehiclesPage';
import { UsersPage } from 'src/features/users/UsersPage';
import { InventoryPage } from 'src/features/inventory/InventoryPage';
import { ReportsPage } from 'src/features/reports/ReportsPage';
import { DriversPage } from 'src/features/drivers/DriversPage';
import { BreweriesPage } from 'src/features/breweries/BreweriesPage';
import { ClientsPage } from 'src/features/clients/ClientsPage';
import { OrdersPage } from 'src/features/orders/OrdersPage';
import { ShipmentsPage } from 'src/features/shipments/ShipmentsPage';
import { DeliveriesPage } from 'src/features/deliveries/DeliveriesPage';
import { LOGIN_PATH, PATHS } from './paths';

export const router = createBrowserRouter([
  { path: LOGIN_PATH, element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: PATHS.orders, element: <OrdersPage /> },
          { path: `${PATHS.orders}/new`, element: <OrdersPage view="create" /> },
          { path: `${PATHS.orders}/:id`, element: <OrdersPage /> },
          { path: `${PATHS.orders}/:id/edit`, element: <OrdersPage view="edit" /> },
          { path: PATHS.shipments, element: <ShipmentsPage /> },
          { path: `${PATHS.shipments}/new`, element: <ShipmentsPage view="create" /> },
          { path: `${PATHS.shipments}/:id`, element: <ShipmentsPage /> },
          { path: `${PATHS.shipments}/:id/edit`, element: <ShipmentsPage view="edit" /> },
          { path: PATHS.deliveries, element: <DeliveriesPage /> },
          { path: `${PATHS.deliveries}/new`, element: <DeliveriesPage view="create" /> },
          { path: `${PATHS.deliveries}/:id`, element: <DeliveriesPage /> },
          { path: `${PATHS.deliveries}/:id/edit`, element: <DeliveriesPage view="edit" /> },
          { path: PATHS.inventory, element: <InventoryPage /> },
          { path: PATHS.breweries, element: <BreweriesPage /> },
          { path: `${PATHS.breweries}/:id`, element: <BreweriesPage /> },
          { path: PATHS.clients, element: <ClientsPage /> },
          { path: `${PATHS.clients}/:id`, element: <ClientsPage /> },
          { path: PATHS.drivers, element: <DriversPage /> },
          { path: PATHS.vehicles, element: <VehiclesPage /> },
          { path: PATHS.userRoles, element: <UsersPage view="roles" /> },
          { path: PATHS.users, element: <UsersPage /> },
          { path: PATHS.reports, element: <ReportsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to={PATHS.dashboard} replace /> },
]);
