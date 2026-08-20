import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseOutlined';
import AddIcon from '@mui/icons-material/AddOutlined';
import { useSnackbar } from 'notistack';
import type { LatLng } from 'src/lib/geo';
import { AddressMapPicker } from 'src/components/common/AddressMapPicker';
import { useShipmentStartPoints } from 'src/hooks/useShipments';
import { startPointKindName } from 'src/lib/labels';

/** What the dialog hands back to its caller: either a free-form custom stop
 * (address + label + optional note), or the company warehouse. The company
 * variant deliberately carries no coordinates — the server authors the
 * Company stop's label and location from configuration and ignores whatever
 * the client sends, so this dialog does not try to supply them. */
export type CustomStopResult =
  | { kind: 'custom'; label: string; note?: string; lat: number; lng: number }
  | { kind: 'company' };

/** Dialog to add a non-order stop, either a custom place (typed address or
 * map click, then named) or the company warehouse. A route carries at most
 * one company stop, so that mode is disabled (with a tooltip) once one
 * already exists — the caller decides that via `hasCompanyStop`.
 *
 * Not every caller's domain has a company-stop concept at all (a delivery
 * already always ends at the company, for instance) — `showCompanyOption`
 * lets such a caller hide the toggle entirely instead of disabling it with a
 * tooltip that would be untrue for that domain. Defaults to true so the
 * shipment editor (this dialog's original and still-primary caller) is
 * unaffected. */
export function CustomStopDialog({
  open,
  onClose,
  onAdd,
  hasCompanyStop = false,
  hasStockPurchases = true,
  showCompanyOption = true,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (stop: CustomStopResult) => void;
  /** Disables the company toggle (with an explanatory tooltip) once the
   *  route already has one. Ignored when `showCompanyOption` is false. */
  hasCompanyStop?: boolean;
  /** Whether the run carries goods for our own warehouse. The server keeps the
   *  Company stop in step with those purchases in both directions, so adding
   *  the stop without them would be undone by the very next save — the toggle
   *  is disabled (with a tooltip) rather than silently swallowing the click.
   *  Defaults to true so a caller with no such concept is unaffected. */
  hasStockPurchases?: boolean;
  showCompanyOption?: boolean;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const startPointsQuery = useShipmentStartPoints();
  const [mode, setMode] = useState<'custom' | 'company'>('custom');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');

  const companyPoint = (startPointsQuery.data ?? []).find((p) => startPointKindName(p.kind) === 'Company');
  // Empty string = enabled; the tooltip and the disabled state are the same
  // decision, so they read off one value and cannot drift apart.
  const companyDisabledReason = hasCompanyStop
    ? 'Trasa už zastávku ve firmě má.'
    : !hasStockPurchases
      ? 'Zastávku ve firmě lze přidat, až bude v nakládce zboží na sklad — jinak ji uložení zase odstraní.'
      : '';

  const reset = () => {
    setMode('custom');
    setPoint(null);
    setLabel('');
    setNote('');
  };
  const close = () => { reset(); onClose(); };

  const confirm = () => {
    if (mode === 'company') {
      onAdd({ kind: 'company' });
      reset();
      onClose();
      return;
    }
    if (!point) { enqueueSnackbar('Určete místo zastávky vyhledáním adresy nebo kliknutím do mapy.', { variant: 'warning' }); return; }
    if (!label.trim()) { enqueueSnackbar('Zadejte název zastávky.', { variant: 'warning' }); return; }
    onAdd({ kind: 'custom', label: label.trim(), note: note.trim() || undefined, lat: point.lat, lng: point.lng });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box component="span" sx={{ flex: 1 }}>Vlastní zastávka</Box>
        <IconButton onClick={close} aria-label="Zavřít" size="small">
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {showCompanyOption && (
          <ToggleButtonGroup
            value={mode}
            exclusive
            size="small"
            onChange={(_, next: 'custom' | 'company' | null) => { if (next) setMode(next); }}
            sx={{ mb: 2 }}
          >
            <ToggleButton value="custom">Vlastní místo</ToggleButton>
            <Tooltip title={companyDisabledReason}>
              <span>
                <ToggleButton value="company" disabled={companyDisabledReason !== ''}>Firemní sklad</ToggleButton>
              </span>
            </Tooltip>
          </ToggleButtonGroup>
        )}

        {mode === 'company' ? (
          <Stack spacing={1.5}>
            <Typography color="text.secondary" sx={{ fontSize: 13 }}>
              Adresu a souřadnice firemního skladu doplní server.
            </Typography>
            <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{companyPoint?.name ?? 'Firemní sklad'}</Typography>
              {companyPoint?.address && (
                <Typography sx={{ fontSize: 12 }} color="text.secondary">{companyPoint.address}</Typography>
              )}
            </Box>
          </Stack>
        ) : (
          <>
            <Typography color="text.secondary" sx={{ fontSize: 13, mb: 1.5 }}>
              Najděte místo podle adresy, nebo klikněte přímo do mapy, poté zastávku pojmenujte.
            </Typography>
            <AddressMapPicker point={point} onPick={(p) => setPoint(p)} />
            <Stack spacing={2}>
              <TextField label="Název zastávky" required fullWidth size="small" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Např. Čerpací stanice, sklad…" />
              <TextField label="Poznámka" fullWidth size="small" value={note} onChange={(e) => setNote(e.target.value)} />
              {point && (
                <Typography sx={{ fontSize: 12, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
                  {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                </Typography>
              )}
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} color="inherit">Zrušit</Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={confirm}>Přidat zastávku</Button>
      </DialogActions>
    </Dialog>
  );
}
