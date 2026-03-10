import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import { useColorScheme } from '@mui/material/styles';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';

export default function ThemeModeSwitcher() {
     const { mode, setMode } = useColorScheme();

     const isDark = mode === 'dark';

     return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
               <LightModeOutlined sx={{ fontSize: 18, color: isDark ? 'text.disabled' : 'warning.main' }} />
               <Switch
                    size="small"
                    checked={isDark}
                    onChange={() => setMode(isDark ? 'light' : 'dark')}
               />
               <DarkModeOutlined sx={{ fontSize: 18, color: isDark ? 'primary.main' : 'text.disabled' }} />
          </Box>
     );
}
