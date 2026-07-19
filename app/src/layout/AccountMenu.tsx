import {
  Menu,
  MenuItem,
  Avatar,
  Box,
  Typography,
  Divider,
  ListItemIcon,
  ListItemText,
  Stack,
} from '@mui/material';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { Chip } from '@mui/material';
import { useAuth } from 'src/auth/AuthProvider';
import { DEMO_USERS } from 'src/auth/mockUsers';
import { initials } from 'src/lib/format';

export function AccountMenu({
  anchorEl,
  onClose,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}) {
  const { user, isDemo, switchUser, signOut } = useAuth();

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
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            Přihlášený uživatel
          </Typography>
          {isDemo && <Chip label="demo" size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />}
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center" mt={1}>
          <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 36, height: 36 }}>
            {initials(user?.firstName, user?.lastName)}
          </Avatar>
          <Box>
            <Typography fontWeight={700} fontSize={14}>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              @{user?.userName} · {user?.roles.includes('Admin') ? 'Administrátor' : 'Uživatel'}
            </Typography>
          </Box>
        </Stack>
      </Box>
      <Divider />
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ px: 2, pt: 1, display: 'block' }}>
        Vyzkoušet jako jinou roli (demo)
      </Typography>
      {DEMO_USERS.map((u) => (
        <MenuItem
          key={u.id}
          onClick={() => {
            switchUser(u);
            onClose();
          }}
        >
          <Avatar sx={{ width: 30, height: 30, mr: 1.5, fontSize: 13, bgcolor: 'action.selected', color: 'text.primary' }}>
            {initials(u.firstName, u.lastName)}
          </Avatar>
          <ListItemText
            primary={`${u.firstName} ${u.lastName}`}
            secondary={u.roles.includes('Admin') ? 'Administrátor — vše' : 'Uživatel — omezená práva'}
            slotProps={{ primary: { fontWeight: 700, fontSize: 13 }, secondary: { fontSize: 11.5 } }}
          />
          {u.id === user?.id && <CheckIcon fontSize="small" color="primary" />}
        </MenuItem>
      ))}
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
