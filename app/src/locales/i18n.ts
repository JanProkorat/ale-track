import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import cs from './cs.json';
import de from './de.json';

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            cs: { translation: cs },
            de: { translation: de },
        },
        lng: 'cs',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;