import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import cs from './locales/cs.json';
import de from './locales/de.json';
import en from './locales/en.json';

i18n
     .use(LanguageDetector)
     .use(initReactI18next)
     .init({
          resources: {
               cs: { translation: cs },
               en: { translation: en },
               de: { translation: de },
          },
          fallbackLng: 'en',
          interpolation: {
               escapeValue: false,
          },
          detection: {
               order: ['localStorage', 'navigator'],
               caches: ['localStorage'],
               lookupLocalStorage: 'aletrack-lang',
          },
     });

export default i18n;
