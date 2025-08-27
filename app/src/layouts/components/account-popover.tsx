import type {IconButtonProps} from '@mui/material/IconButton';

import {useState, useCallback} from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Popover from '@mui/material/Popover';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import {useRouter} from 'src/routes/hooks';

import {useAuth} from "../../context/AuthContext";

// ----------------------------------------------------------------------

export type AccountPopoverProps = IconButtonProps;

export function AccountPopover({sx, ...other}: AccountPopoverProps) {
    const router = useRouter();

    const {signOut, user} = useAuth();

    const [openPopover, setOpenPopover] = useState<HTMLButtonElement | null>(null);

    const handleOpenPopover = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        setOpenPopover(event.currentTarget);
    }, []);

    const handleClosePopover = useCallback(() => {
        setOpenPopover(null);
    }, []);

    const handleSignOut = useCallback(() => {
        signOut().then(() => router.push('/'));
    }, [router, signOut]);

    return (
        <>
            <IconButton
                onClick={handleOpenPopover}
                sx={{
                    p: '2px',
                    width: 40,
                    height: 40,
                    background: (theme) =>
                        `conic-gradient(${theme.vars.palette.primary.light}, ${theme.vars.palette.warning.light}, ${theme.vars.palette.primary.light})`,
                    ...sx,
                }}
                {...other}
            >
                <Avatar src="/assets/images/avatar/avatar-25.webp" alt={user?.name} sx={{width: 1, height: 1}}>
                    {user?.name}
                </Avatar>
            </IconButton>

            <Popover
                open={!!openPopover}
                anchorEl={openPopover}
                onClose={handleClosePopover}
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
                slotProps={{
                    paper: {
                        sx: {width: 200},
                    },
                }}
            >
                <Box sx={{ p: 2, pb: 1.5, display: 'flex', justifyContent: 'center' }}>
                    <Typography variant="subtitle2" noWrap>
                        {user && user.name ? user.name.charAt(0).toUpperCase() + user.name.slice(1) : ""}
                    </Typography>
                </Box>

                <Divider sx={{borderStyle: 'dashed'}}/>

                <Box sx={{p: 1}}>
                    <Button fullWidth color="error" size="medium" variant="text" onClick={handleSignOut}>
                        Logout
                    </Button>
                </Box>
            </Popover>
        </>
    );
}
