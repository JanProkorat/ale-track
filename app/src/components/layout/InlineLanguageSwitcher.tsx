import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';

// ---------------------------------------------------------------------------
// Language options
// ---------------------------------------------------------------------------

const languages = [
     { code: 'cs', flag: '/assets/icons/flags/cs.svg', label: 'Čeština' },
     { code: 'en', flag: '/assets/icons/flags/en.svg', label: 'English' },
     { code: 'de', flag: '/assets/icons/flags/de.svg', label: 'Deutsch' },
];

// ---------------------------------------------------------------------------
// Inline language switcher — shows all flags in a row
// ---------------------------------------------------------------------------

export default function InlineLanguageSwitcher() {
     const { i18n } = useTranslation();
     const currentCode = languages.find((l) => i18n.language?.startsWith(l.code))?.code ?? 'cs';

     return (
          <Box sx={{ display: 'flex', gap: 0.25 }}>
               {languages.map((lang) => {
                    const isActive = lang.code === currentCode;
                    return (
                         <IconButton
                              key={lang.code}
                              size="small"
                              onClick={() => i18n.changeLanguage(lang.code)}
                              sx={{
                                   p: 0.5,
                                   borderRadius: 1,
                                   opacity: isActive ? 1 : 0.4,
                                   transition: 'opacity 150ms',
                                   '&:hover': { opacity: 1 },
                              }}
                         >
                              <Box
                                   component="img"
                                   src={lang.flag}
                                   alt={lang.label}
                                   sx={{
                                        width: 22,
                                        height: 16,
                                        borderRadius: 0.3,
                                        objectFit: 'cover',
                                   }}
                              />
                         </IconButton>
                    );
               })}
          </Box>
     );
}
