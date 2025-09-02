import './locales/i18n';
import 'dayjs/locale/cs';
import 'dayjs/locale/en';
import 'dayjs/locale/de';

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import {Outlet, RouterProvider, createBrowserRouter} from 'react-router';

import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import App from './app';
import {routesSection} from './routes/sections';
import {ErrorBoundary} from './routes/components';
import {AuthProvider} from "./context/AuthContext";
import {SnackbarProvider} from "./providers/SnackbarProvider";
import {CurrencyProvider} from "./providers/currency-provider";
import {EntityStatsProvider} from "./providers/EntityStatsContext";

// ----------------------------------------------------------------------

export const router = createBrowserRouter([
    {
        Component: () => {
            const { i18n } = useTranslation();
            const localeMap: Record<string, string> = { cs: 'cs', en: 'en', de: 'de' };
            const currentLocale = localeMap[i18n.language] || 'en';

            return (
                <AuthProvider>
                    <SnackbarProvider>
                        <EntityStatsProvider>
                            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={currentLocale}>
                                <CurrencyProvider>
                                    <App>
                                        <Outlet/>
                                    </App>
                                </CurrencyProvider>
                            </LocalizationProvider>
                        </EntityStatsProvider>
                    </SnackbarProvider>
                </AuthProvider>
            );
        },
        errorElement: <ErrorBoundary/>,
        children: routesSection,
    },
]);

const root = createRoot(document.getElementById('root')!);

root.render(
    <StrictMode>
        <RouterProvider router={router}/>
    </StrictMode>
);
