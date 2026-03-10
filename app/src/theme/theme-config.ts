import type { CommonColors } from '@mui/material/styles';

import type { ThemeCssVariables } from './types';
import type { PaletteColorNoChannels } from './core/palette';

// ----------------------------------------------------------------------

type ThemeConfig = {
     classesPrefix: string;
     cssVariables: ThemeCssVariables;
     fontFamily: Record<'primary' | 'secondary', string>;
     palette: Record<'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error', PaletteColorNoChannels> & {
          common: Pick<CommonColors, 'black' | 'white'>;
          grey: Record<'50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900', string>;
     };
};

export const themeConfig: ThemeConfig = {
     /** **************************************
      * Base
      *************************************** */
     classesPrefix: 'minimal',
     /** **************************************
      * Typography
      *************************************** */
     fontFamily: {
          primary: 'DM Sans Variable',
          secondary: 'Barlow',
     },
     /** **************************************
      * Palette
      *************************************** */
     palette: {
          primary: {
               lighter: '#DBEAFE',
               light: '#60A5FA',
               main: '#2563EB',
               dark: '#1D4ED8',
               darker: '#1E3A5F',
               contrastText: '#FFFFFF',
          },
          secondary: {
               lighter: '#EDE9FE',
               light: '#A78BFA',
               main: '#7C3AED',
               dark: '#5B21B6',
               darker: '#2E1065',
               contrastText: '#FFFFFF',
          },
          info: {
               lighter: '#CFFAFE',
               light: '#22D3EE',
               main: '#0891B2',
               dark: '#0E7490',
               darker: '#164E63',
               contrastText: '#FFFFFF',
          },
          success: {
               lighter: '#DCFCE7',
               light: '#4ADE80',
               main: '#16A34A',
               dark: '#15803D',
               darker: '#14532D',
               contrastText: '#ffffff',
          },
          warning: {
               lighter: '#FEF9C3',
               light: '#FACC15',
               main: '#EAB308',
               dark: '#A16207',
               darker: '#713F12',
               contrastText: '#1C252E',
          },
          error: {
               lighter: '#FEE2E2',
               light: '#F87171',
               main: '#EF4444',
               dark: '#B91C1C',
               darker: '#7F1D1D',
               contrastText: '#FFFFFF',
          },
          grey: {
               '50': '#F8FAFC',
               '100': '#F1F5F9',
               '200': '#E2E8F0',
               '300': '#CBD5E1',
               '400': '#94A3B8',
               '500': '#64748B',
               '600': '#475569',
               '700': '#334155',
               '800': '#1E293B',
               '900': '#0F172A',
          },
          common: { black: '#000000', white: '#FFFFFF' },
     },
     /** **************************************
      * Css variables
      *************************************** */
     cssVariables: {
          cssVarPrefix: '',
          colorSchemeSelector: 'data-color-scheme',
     },
};
