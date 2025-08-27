import type {RouteObject} from 'react-router';

import {jwtDecode} from "jwt-decode";
import React, {lazy, Suspense} from 'react';
import {varAlpha} from 'minimal-shared/utils';
import {Outlet, Navigate} from 'react-router-dom';

import Box from '@mui/material/Box';
import LinearProgress, {linearProgressClasses} from '@mui/material/LinearProgress';

import {AuthLayout} from 'src/layouts/auth';
import {DashboardLayout} from 'src/layouts/dashboard';

import {UserRoleType} from "../api/Client";
import {useAuth} from "../context/AuthContext";

// ----------------------------------------------------------------------

export const DashboardPage = lazy(() => import('src/pages/dashboard'));
export const ClientsPage = lazy(() => import('src/pages/clients'));
export const DriversPage = lazy(() => import('src/pages/drivers'));
export const VehiclesPage = lazy(() => import('src/pages/vehicles'));
export const SignInPage = lazy(() => import('src/pages/sign-in'));
export const BreweriesPage = lazy(() => import('src/pages/breweries'));
export const Page404 = lazy(() => import('src/pages/page-not-found'));
export const ProductDeliveriesPage = lazy(() => import('src/pages/product-deliveries'));
export const InventoryPage = lazy(() => import('src/pages/inventory'));
export const UsersPage = lazy(() => import('src/pages/users'));
export const OrdersPage = lazy(() => import('src/pages/orders'));

const renderFallback = () => (
  <Box
    sx={{
      display: 'flex',
      flex: '1 1 auto',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <LinearProgress
      sx={{
        width: 1,
        maxWidth: 320,
        bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
        [`& .${linearProgressClasses.bar}`]: { bgcolor: 'text.primary' },
      }}
    />
  </Box>
);

const RedirectToStart = () => {
    const token = localStorage.getItem('authToken');
    try {
        const { exp } = jwtDecode<{ exp: number }>(token ?? '');
        const isExpired = exp * 1000 < Date.now();
        return <Navigate to={isExpired ? '/sign-in' : '/dashboard'} replace />;
    } catch {
        return <Navigate to="/sign-in" replace />;
    }
};

type RequireRoleProps = {
    allowedRoles: UserRoleType[];
    children: React.ReactNode;
};

export const RequireRole = ({ allowedRoles, children }: RequireRoleProps) => {
    const { user, isInitialized } = useAuth();

    if (!isInitialized) {
        return null;
    }

    if (!user) {
        return <Navigate to="/404" replace />;
    }

    const numericState = UserRoleType[user.role as unknown as keyof typeof UserRoleType];
    if (!allowedRoles.includes(numericState)){
        return <Navigate to="/404" replace />;
    }

    return <>{children}</>;
};

export const routesSection: RouteObject[] = [
  {
    element: (
      <DashboardLayout>
        <Suspense fallback={renderFallback()}>
          <Outlet />
        </Suspense>
      </DashboardLayout>
    ),
    children: [
        {
            path: '/',
            element: <RedirectToStart />
        },
        {
            path: 'dashboard',
            element:
                <RequireRole allowedRoles={[UserRoleType.User, UserRoleType.Admin]}>
                    <DashboardPage />
                </RequireRole>
        },
        {
            path: 'clients',
            element:
                <RequireRole allowedRoles={[UserRoleType.User, UserRoleType.Admin]}>
                    <ClientsPage />
                </RequireRole>
        },
        {
            path: 'orders',
            element:
                <RequireRole allowedRoles={[UserRoleType.User, UserRoleType.Admin]}>
                    <OrdersPage />
                </RequireRole>
        },
        {
            path: 'breweries',
            element:
                <RequireRole allowedRoles={[UserRoleType.User, UserRoleType.Admin]}>
                    <BreweriesPage />
                </RequireRole>
        },
        {
            path: 'drivers',
            element:
                <RequireRole allowedRoles={[UserRoleType.User, UserRoleType.Admin]}>
                    <DriversPage />
                </RequireRole>
        },
        {
            path: 'vehicles',
            element:
                <RequireRole allowedRoles={[UserRoleType.User, UserRoleType.Admin]}>
                    <VehiclesPage />
                </RequireRole>
        },
        {
            path: 'product-deliveries',
            element:
                <RequireRole allowedRoles={[UserRoleType.User, UserRoleType.Admin]}>
                    <ProductDeliveriesPage />
                </RequireRole>
        },
        {
            path: 'inventory',
            element:
                <RequireRole allowedRoles={[UserRoleType.User, UserRoleType.Admin]}>
                    <InventoryPage />
                </RequireRole>
        },
        {
            path: 'users',
            element:
                <RequireRole allowedRoles={[UserRoleType.Admin]}>
                    <UsersPage />
                </RequireRole>
        },
    ],
  },
  {
    path: 'sign-in',
    element: (
      <AuthLayout>
        <SignInPage />
      </AuthLayout>
    ),
  },
  {
    path: '404',
    element: <Page404 />,
  },
  { path: '*', element: <Page404 /> },
];
