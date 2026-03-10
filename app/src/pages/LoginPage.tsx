import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import Visibility from '@mui/icons-material/Visibility';
import InputAdornment from '@mui/material/InputAdornment';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

import useAuth from 'src/hooks/useAuth';
import { useNotification } from 'src/hooks/useNotification';

import LanguageSwitcher from 'src/components/layout/LanguageSwitcher';
import ThemeModeSwitcher from 'src/components/layout/ThemeModeSwitcher';

// ---------------------------------------------------------------------------
// Login Page
// ---------------------------------------------------------------------------

export default function LoginPage() {
     const { t } = useTranslation();
     const navigate = useNavigate();
     const { login } = useAuth();
     const { showError } = useNotification();

     const [userName, setUserName] = useState('');
     const [password, setPassword] = useState('');
     const [showPassword, setShowPassword] = useState(false);
     const [loading, setLoading] = useState(false);

     const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          setLoading(true);
          try {
               await login(userName, password);
               navigate('/', { replace: true });
          } catch {
               showError(t('auth.loginError'));
          } finally {
               setLoading(false);
          }
     };

     return (
          <Box
               sx={{
                    display: 'flex',
                    minHeight: '100dvh',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundImage: 'url(/assets/background/overlay.jpg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
               }}
          >
               {/* Language — top right */}
               <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LanguageSwitcher />
               </Box>

               {/* Theme mode — bottom right */}
               <Box sx={{ position: 'absolute', bottom: 16, right: 16 }}>
                    <ThemeModeSwitcher />
               </Box>

               {/* Login card */}
               <Card
                    sx={{
                         width: '100%',
                         maxWidth: 420,
                         mx: 2,
                         p: { xs: 3, sm: 5 },
                         borderRadius: 3,
                         boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
                    }}
               >
                    {/* Logo */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 3 }}>
                         <Box
                              component="img"
                              src="/assets/images/logo/logo-small.png"
                              alt="AleTrack"
                              sx={{ height: 48 }}
                         />
                         <Typography variant="h4" fontWeight={700}>
                              AleTrack
                         </Typography>
                    </Box>

                    <Typography variant="h6" align="center" sx={{ mb: 4 }}>
                         {t('auth.login')}
                    </Typography>

                    <Box component="form" onSubmit={handleSubmit} noValidate>
                         <TextField
                              label={t('auth.username')}
                              value={userName}
                              onChange={(e) => setUserName(e.target.value)}
                              fullWidth
                              autoFocus
                              autoComplete="username"
                              sx={{ mb: 2.5 }}
                         />

                         <TextField
                              label={t('auth.password')}
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              fullWidth
                              autoComplete="current-password"
                              sx={{ mb: 3 }}
                              slotProps={{
                                   input: {
                                        endAdornment: (
                                             <InputAdornment position="end">
                                                  <IconButton
                                                       onClick={() => setShowPassword((v) => !v)}
                                                       edge="end"
                                                  >
                                                       {showPassword ? <VisibilityOff /> : <Visibility />}
                                                  </IconButton>
                                             </InputAdornment>
                                        ),
                                   },
                              }}
                         />

                         <LoadingButton
                              type="submit"
                              variant="contained"
                              fullWidth
                              size="large"
                              loading={loading}
                              disabled={!userName || !password}
                              sx={{
                                   py: 1.5,
                                   bgcolor: 'grey.800',
                                   borderRadius: 2,
                                   '&:hover': { bgcolor: 'grey.700' },
                              }}
                         >
                              {t('auth.login')}
                         </LoadingButton>
                    </Box>
               </Card>
          </Box>
     );
}
