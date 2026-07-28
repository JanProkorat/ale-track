import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Stack,
  TextField,
  Button,
  Typography,
  Alert,
  IconButton,
  InputAdornment,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { useAuth } from 'src/auth/AuthProvider';
import { Logo } from 'src/components/common/Logo';
import { PATHS } from 'src/routes/paths';
import { useThemeMode } from 'src/theme/ThemeProvider';

const NAVY = '#1E2A3A';

const FEATURES = [
  { icon: <ReceiptLongOutlinedIcon fontSize="small" />, label: 'Objednávky s historií klienta' },
  { icon: <RouteOutlinedIcon fontSize="small" />, label: 'Vývozy s plánováním trasy' },
  { icon: <Inventory2OutlinedIcon fontSize="small" />, label: 'Sklad, dovozy a nakládka' },
];

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { resolved, toggle } = useThemeMode();

  const from = (location.state as { from?: string } | null)?.from ?? PATHS.dashboard;
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn(userName, password, remember);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Přihlášení selhalo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Brand panel */}
      <Box
        sx={{
          flex: 1.1,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
          position: 'relative',
          overflow: 'hidden',
          background: `linear-gradient(155deg, ${NAVY} 0%, #17212E 60%, #0c1420 100%)`,
          color: '#cdd7e3',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -140,
            right: -120,
            width: 460,
            height: 460,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(240,140,0,.35), transparent 65%)',
            filter: 'blur(10px)',
          }}
        />
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ position: 'relative' }}>
          <Logo size={40} />
          <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>
            Ale<Box component="span" sx={{ color: 'primary.main' }}>Track</Box>
          </Typography>
        </Stack>
        <Box sx={{ position: 'relative' }}>
          <Typography sx={{ fontSize: 38, fontWeight: 800, color: '#fff', lineHeight: 1.1, mb: 2 }}>
            Řízení distribuce piva
            <br />
            na jednom místě.
          </Typography>
          <Typography sx={{ fontSize: 15.5, color: '#9fb0c4', maxWidth: 440, mb: 3.5 }}>
            Pivovary, klienti, objednávky, vývozy s optimalizací trasy a sklad — přehledně, rychle a bez papírů.
          </Typography>
          <Stack spacing={1.5}>
            {FEATURES.map((f) => (
              <Stack key={f.label} direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ color: 'primary.main' }}>{f.icon}</Box>
                <Typography sx={{ fontWeight: 600, color: '#c7d2df', fontSize: 14.5 }}>{f.label}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Typography sx={{ fontSize: 12.5, color: '#5f7185', position: 'relative' }}>© 2026 AleTrack</Typography>
      </Box>

      {/* Form */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4, position: 'relative', bgcolor: 'background.default' }}>
        <IconButton onClick={toggle} sx={{ position: 'absolute', top: 22, right: 22 }} aria-label="Přepnout motiv">
          {resolved === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
        </IconButton>

        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="center" sx={{ display: { md: 'none' }, mb: 3 }}>
            <Logo size={38} />
            <Typography sx={{ fontSize: 24, fontWeight: 800 }}>
              Ale<Box component="span" sx={{ color: 'primary.main' }}>Track</Box>
            </Typography>
          </Stack>

          <Typography variant="h4" sx={{ fontSize: 26, mb: 0.5 }}>
            Přihlášení
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2.75 }}>
            Zadejte přihlašovací údaje pro vstup do aplikace.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Stack
            component="form"
            spacing={2}
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <TextField
              label="Uživatelské jméno"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              autoComplete="username"
              fullWidth
            />
            <TextField
              label="Heslo"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPw((v) => !v)} edge="end" size="small">
                        {showPw ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <FormControlLabel
                control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} size="small" />}
                label="Zapamatovat si mě"
                slotProps={{ typography: { fontSize: 13 } }}
              />
            </Stack>
            <Button type="submit" variant="contained" size="large" startIcon={<LoginOutlinedIcon />} disabled={busy} sx={{ height: 46 }}>
              {busy ? 'Přihlašuji…' : 'Přihlásit se'}
            </Button>
          </Stack>

        </Box>
      </Box>
    </Box>
  );
}
