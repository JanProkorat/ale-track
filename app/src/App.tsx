import { lazy, Suspense } from 'react';
import { SnackbarProvider } from 'notistack';
import { Route, Routes, Navigate, BrowserRouter } from 'react-router-dom';

import LoginPage from 'src/pages/LoginPage';
import AuthProvider from 'src/providers/AuthProvider';
import QueryProvider from 'src/providers/QueryProvider';
import ThemeProvider from 'src/providers/ThemeProvider';
import CurrencyProvider from 'src/providers/CurrencyProvider';
import UnsavedChangesProvider from 'src/providers/UnsavedChangesProvider';

import AppLayout from 'src/components/layout/AppLayout';
import RequireAuth from 'src/components/layout/RequireAuth';
import RequireAdmin from 'src/components/layout/RequireAdmin';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

// ---------------------------------------------------------------------------
// Lazy-loaded pages
// ---------------------------------------------------------------------------

const DashboardPage = lazy(() => import('src/pages/DashboardPage'));

const BreweryListPage = lazy(() => import('src/pages/breweries/BreweryListPage'));

const VehicleListPage = lazy(() => import('src/pages/vehicles/VehicleListPage'));
const VehicleFormPage = lazy(() => import('src/pages/vehicles/VehicleFormPage'));

const DriverListPage = lazy(() => import('src/pages/drivers/DriverListPage'));
const DriverDetailPage = lazy(() => import('src/pages/drivers/DriverDetailPage'));
const DriverFormPage = lazy(() => import('src/pages/drivers/DriverFormPage'));

const ProductListPage = lazy(() => import('src/pages/products/ProductListPage'));
const ProductDetailPage = lazy(() => import('src/pages/products/ProductDetailPage'));
const ProductFormPage = lazy(() => import('src/pages/products/ProductFormPage'));

const ClientListPage = lazy(() => import('src/pages/clients/ClientListPage'));

const OrderListPage = lazy(() => import('src/pages/orders/OrderListPage'));

const ProductDeliveryListPage = lazy(() => import('src/pages/productDeliveries/ProductDeliveryListPage'));

const OutgoingShipmentListPage = lazy(() => import('src/pages/outgoingShipments/OutgoingShipmentListPage'));

const UserListPage = lazy(() => import('src/pages/users/UserListPage'));
const UserFormPage = lazy(() => import('src/pages/users/UserFormPage'));

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
     return (
          <SnackbarProvider
               maxSnack={3}
               anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
               autoHideDuration={4000}
               preventDuplicate
          >
               <ThemeProvider>
                    <QueryProvider>
                         <BrowserRouter>
                              <AuthProvider>
                                   <CurrencyProvider>
                                        <UnsavedChangesProvider>
                                             <Suspense fallback={<LoadingSpinner />}>
                                        <Routes>
                                             <Route path="/login" element={<LoginPage />} />

                                             {/* Protected routes */}
                                             <Route
                                                  element={
                                                       <RequireAuth>
                                                            <AppLayout />
                                                       </RequireAuth>
                                                  }
                                             >
                                                  <Route path="/" element={<DashboardPage />} />

                                                  {/* Breweries */}
                                                  <Route path="/breweries" element={<BreweryListPage />} />

                                                  {/* Vehicles */}
                                                  <Route path="/vehicles" element={<VehicleListPage />} />
                                                  <Route path="/vehicles/new" element={<VehicleFormPage />} />
                                                  <Route path="/vehicles/:id/edit" element={<VehicleFormPage />} />

                                                  {/* Drivers */}
                                                  <Route path="/drivers" element={<DriverListPage />} />
                                                  <Route path="/drivers/new" element={<DriverFormPage />} />
                                                  <Route path="/drivers/:id" element={<DriverDetailPage />} />
                                                  <Route path="/drivers/:id/edit" element={<DriverFormPage />} />

                                                  {/* Products */}
                                                  <Route path="/products" element={<ProductListPage />} />
                                                  <Route path="/products/new" element={<ProductFormPage />} />
                                                  <Route path="/products/:id" element={<ProductDetailPage />} />
                                                  <Route path="/products/:id/edit" element={<ProductFormPage />} />

                                                  {/* Clients */}
                                                  <Route path="/clients" element={<ClientListPage />} />

                                                  {/* Admin-only routes */}
                                                  <Route
                                                       path="/users"
                                                       element={
                                                            <RequireAdmin>
                                                                 <UserListPage />
                                                            </RequireAdmin>
                                                       }
                                                  />
                                                  <Route
                                                       path="/users/new"
                                                       element={
                                                            <RequireAdmin>
                                                                 <UserFormPage />
                                                            </RequireAdmin>
                                                       }
                                                  />
                                                  <Route
                                                       path="/users/:id/edit"
                                                       element={
                                                            <RequireAdmin>
                                                                 <UserFormPage />
                                                            </RequireAdmin>
                                                       }
                                                  />

                                                  {/* Orders */}
                                                  <Route path="/orders" element={<OrderListPage />} />
                                                  <Route path="/inventory" element={<div>Inventory — coming soon</div>} />
                                                  <Route path="/product-deliveries" element={<ProductDeliveryListPage />} />
                                                  <Route path="/outgoing-shipments" element={<OutgoingShipmentListPage />} />
                                                  <Route path="/reminders" element={<div>Reminders — coming soon</div>} />
                                                  <Route path="/exchange-rates" element={<div>Exchange Rates — coming soon</div>} />

                                                  <Route path="*" element={<Navigate to="/" replace />} />
                                             </Route>
                                        </Routes>
                                             </Suspense>
                                        </UnsavedChangesProvider>
                                   </CurrencyProvider>
                              </AuthProvider>
                         </BrowserRouter>
                    </QueryProvider>
               </ThemeProvider>
          </SnackbarProvider>
     );
}
