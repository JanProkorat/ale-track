import {
  Menu,
  MenuItem,
  Avatar,
  Box,
  Typography,
  Divider,
  ListItemIcon,
  Stack,
} from '@mui/material';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useAuth } from 'src/auth/AuthProvider';
import { roleOfRoles, ROLE_CLAIM_LABELS } from 'src/auth/capabilities';
import { initials } from 'src/lib/format';

export function AccountMenu({
  anchorEl,
  onClose,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}) {
  const { user, signOut } = useAuth();

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      slotProps={{ paper: { sx: { width: 300, mt: -1 } } }}
    >
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          Přihlášený uživatel
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" mt={1}>
          <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 36, height: 36 }}>
            {initials(user?.firstName, user?.lastName)}
          </Avatar>
          <Box>
            <Typography fontWeight={700} fontSize={14}>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              @{user?.userName} · {user ? ROLE_CLAIM_LABELS[roleOfRoles(user.roles)] : ''}
            </Typography>
          </Box>
        </Stack>
      </Box>
      <Divider />
      <MenuItem
        onClick={() => {
          onClose();
          signOut();
        }}
        sx={{ color: 'error.main' }}
      >
        <ListItemIcon sx={{ color: 'error.main' }}>
          <LogoutOutlinedIcon fontSize="small" />
        </ListItemIcon>
        Odhlásit se
      </MenuItem>
    </Menu>
  );
}
