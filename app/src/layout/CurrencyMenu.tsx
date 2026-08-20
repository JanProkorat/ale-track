import { Popover, Box, Typography, ToggleButtonGroup, ToggleButton, Stack, Divider } from '@mui/material';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { fmtDate, num } from 'src/lib/format';

export function CurrencyMenu({
  anchorEl,
  onClose,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}) {
  const { currency, setCurrency, eurRate, rateUpdatedAt } = useCurrency();
  return (
    <Popover
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { width: 300, p: 2, mt: 1 } } }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>
        Zobrazovat ceny v
      </Typography>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={currency}
        onChange={(_, v) => v && setCurrency(v)}
        sx={{ mt: 1 }}
      >
        <ToggleButton value="CZK">Kč — koruna</ToggleButton>
        <ToggleButton value="EUR">€ — euro</ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: 'background.default' }}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">
            Aktuální kurz
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            1 € = {num(eurRate)} Kč
          </Typography>
        </Stack>
        <Divider sx={{ my: 1 }} />
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">
            Aktualizováno
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            {fmtDate(rateUpdatedAt)}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Kurz se načítá automaticky každý den (ČNB) a propisuje se do všech cen. Ceny se ukládají v Kč a přepočítávají pro zobrazení.
        </Typography>
      </Box>
    </Popover>
  );
}
