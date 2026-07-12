import '@fontsource-variable/dm-sans';
import 'dayjs/locale/cs';
import 'dayjs/locale/de';

import dayjs from 'dayjs';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { csCZ, deDE, enUS } from '@mui/material/locale';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { csCZ as dateCs, deDE as dateDe, enUS as dateEn } from '@mui/x-date-pickers/locales';

import { ThemeProvider as CoreThemeProvider } from 'src/theme/theme-provider';

// ---------------------------------------------------------------------------
// Locale maps
// ---------------------------------------------------------------------------

const muiLocaleMap: Record<string, typeof csCZ> = { cs: csCZ, en: enUS, de: deDE };
const dateLocaleMap: Record<string, typeof dateCs> = { cs: dateCs, en: dateEn, de: dateDe };
const dayjsLocaleMap: Record<string, string> = { cs: 'cs', en: 'en', de: 'de' };

// ---------------------------------------------------------------------------
// Theme Provider
// ---------------------------------------------------------------------------

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
     const { i18n } = useTranslation();
     const lang = i18n.language?.substring(0, 2) ?? 'en';

     const locales = useMemo(() => {
          dayjs.locale(dayjsLocaleMap[lang] ?? 'en');
          return [
               muiLocaleMap[lang] ?? enUS,
               dateLocaleMap[lang] ?? dateEn,
          ];
     }, [lang]);

     return (
          <CoreThemeProvider locales={locales}>
               <LocalizationProvider
                    dateAdapter={AdapterDayjs}
                    adapterLocale={dayjsLocaleMap[lang] ?? 'en'}
               >
                    {children}
               </LocalizationProvider>
          </CoreThemeProvider>
     );
}
