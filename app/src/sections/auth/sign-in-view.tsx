import type {LoginUserDto} from 'src/api/Client';

import {useState, useCallback} from 'react';
import {useTranslation} from "react-i18next";
import {varAlpha} from "minimal-shared/utils";

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress, {linearProgressClasses} from '@mui/material/LinearProgress';

import {useRouter} from 'src/routes/hooks';

import {Iconify} from 'src/components/iconify';

import {useAuth} from "../../context/AuthContext";
import {AuthorizedClient} from "../../api/AuthorizedClient";

// ----------------------------------------------------------------------

export function SignInView() {
    const router = useRouter();

    const [showPassword, setShowPassword] = useState(false);
    const [userName, setUserName] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<boolean>(false);

    const { signIn } = useAuth();
    const {t} = useTranslation();

    const handleSignIn = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(false);

            const client = new AuthorizedClient();
            const loginData = {userName, password} as LoginUserDto;

            const response = await client.loginEndpoint(loginData);
            if (response && response.accessToken) {
                signIn(response.accessToken);
                router.push('/dashboard');
            } else {
                setError(true);
            }
        } catch (err) {
            setError(true);
        } finally {
            setIsLoading(false);
        }
    }, [userName, password, signIn, router]);

    const renderForm = (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'flex-end',
                flexDirection: 'column',
            }}
        >
            <TextField
                fullWidth
                name="userName"
                label={t('common.userName')}
                sx={{mb: 3}}
                slotProps={{
                    inputLabel: {shrink: true},
                }}
                onChange={(e) => setUserName(e.target.value)}
            />

            <TextField
                fullWidth
                name="password"
                label={t('common.password')}
                type={showPassword ? 'text' : 'password'}
                slotProps={{
                    inputLabel: {shrink: true},
                    input: {
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                    <Iconify icon={showPassword ? 'solar:eye-bold' : 'solar:eye-closed-bold'}/>
                                </IconButton>
                            </InputAdornment>
                        ),
                    },
                }}
                sx={{mb: 3}}
                onChange={(e) => setPassword(e.target.value)}
            />

            <Button
                type="button"
                fullWidth
                size="large"
                color="inherit"
                variant="contained"
                disabled={userName.length === 0 || password.length === 0 || isLoading}
                onClick={handleSignIn}
            >
                {isLoading ? "" : t('signIn.signInLabel')}
            </Button>

            {isLoading && (
                <LinearProgress
                    sx={{
                        width: 1,
                        maxWidth: 320,
                        top: -25,
                        left: -30,
                        bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
                        [`& .${linearProgressClasses.bar}`]: {bgcolor: 'text.primary'},
                    }}
                />
            )}

            <Typography
                variant="button"
                color="error"
                sx={{
                    mt: 2,
                    mb: -3,
                    mr: 10,
                    textAlign: 'center',
                    display: error ? 'block' : 'none',
                }}>
                {t('signIn.error')}
            </Typography>
        </Box>
    );

    return (
        <>
            <Box
                sx={{
                    gap: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mb: 5,
                }}
            >
                <Typography variant="h5">{t('signIn.signInAction')}</Typography>
            </Box>
            {renderForm}
        </>
    );
}
