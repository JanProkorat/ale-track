import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, TextField, Button, Typography, Alert, Chip } from '@mui/material';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import { useAuth } from 'src/auth/AuthProvider';
import { DEMO_USERS } from 'src/auth/mockUsers';
import { Logo } from 'src/components/common/Logo';
import { PATHS } from 'src/routes/paths';

// Minimal functional login for P1. The branded split-screen + real POST /login
// lands in P3.
export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [userName, setUserName] = useState('admin');
  const [password, setPassword] = useState('demo');
  const [error, setError] = useState<string | null>(null);

  const submit = async (u = userName, p = password) => {
    try {
      await signIn(u, p);
      navigate(PATHS.dashboard, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Přihlášení selhalo.');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 3 }}>
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="center" mb={3}>
          <Logo size={38} />
          <Typography sx={{ fontSize: 24, fontWeight: 800 }}>
            Ale<Box component="span" sx={{ color: 'primary.main' }}>Track</Box>
          </Typography>
        </Stack>
        <Typography variant="h5" mb={0.5}>
          Přihlášení
        </Typography>
        <Typography color="text.secondary" mb={2.5}>
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
          <TextField label="Uživatelské jméno" value={userName} onChange={(e) => setUserName(e.target.value)} fullWidth />
          <TextField label="Heslo" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
          <Button type="submit" variant="contained" size="large" startIcon={<LoginOutlinedIcon />}>
            Přihlásit se
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3, mb: 1, textAlign: 'center' }}>
          Demo účty
        </Typography>
        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
          {DEMO_USERS.map((u) => (
            <Chip
              key={u.id}
              label={`${u.firstName} · ${u.roles.includes('Admin') ? 'admin' : 'uživatel'}`}
              onClick={() => {
                setUserName(u.userName);
                setPassword('demo');
                void submit(u.userName, 'demo');
              }}
              sx={{ mb: 1 }}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
