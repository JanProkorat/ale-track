import type { Locale} from 'date-fns';

import {format} from 'date-fns';
import { cs, de, enUS } from 'date-fns/locale';

import i18n from './i18n'; 

const locales: Record<string, Locale> = {
    cs,
    en: enUS,
    de,
};

export function formatDate(date: Date, formatStr = 'PPP') {
    const lang = i18n.language;
    const locale = locales[lang] || enUS;

    return format(date, formatStr, { locale });
}