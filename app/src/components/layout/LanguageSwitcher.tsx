import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';

// ---------------------------------------------------------------------------
// Language options
// ---------------------------------------------------------------------------

const languages = [
     { code: 'cs', label: 'Čeština', flag: '/assets/icons/flags/cs.svg' },
     { code: 'en', label: 'English', flag: '/assets/icons/flags/en.svg' },
     { code: 'de', label: 'Deutsch', flag: '/assets/icons/flags/de.svg' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LanguageSwitcher() {
     const { i18n } = useTranslation();
     const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

     const currentLang = languages.find((l) => i18n.language?.startsWith(l.code)) ?? languages[0];

     return (
          <>
               <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
                    <Box
                         component="img"
                         src={currentLang.flag}
                         alt={currentLang.label}
                         sx={{ width: 28, height: 20, borderRadius: 0.5, objectFit: 'cover' }}
                    />
               </IconButton>

               <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                    {languages.map((lang) => (
                         <MenuItem
                              key={lang.code}
                              selected={lang.code === currentLang.code}
                              onClick={() => {
                                   i18n.changeLanguage(lang.code);
                                   setAnchorEl(null);
                              }}
                         >
                              <Box
                                   component="img"
                                   src={lang.flag}
                                   alt={lang.label}
                                   sx={{ width: 24, height: 18, borderRadius: 0.5, objectFit: 'cover', mr: 1.5 }}
                              />
                              {lang.label}
                         </MenuItem>
                    ))}
               </Menu>
          </>
     );
}
