import { Box, Card, MenuItem, Select, Stack, Typography } from '@mui/material';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import { useShipmentStartPoints } from 'src/hooks/useShipments';
import { ShipmentStartPointKind } from 'src/generated/api-client';
import { optionKey, type StartPointValue } from './startPointOption';

/** Where the run is loaded before it sets off.
 *
 * Sits above "Pořadí zastávek" because it is the route's first point without being
 * a stop: nothing is delivered there, so it is not in the numbering. The company is
 * first in the list and the default — that is what every run did before this
 * existed. */
export function StartPointPicker({ value, onChange, disabled }: {
  value: StartPointValue;
  onChange: (next: StartPointValue) => void;
  disabled?: boolean;
}) {
  const { data, isPending, isError } = useShipmentStartPoints();

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1}
        sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
        <WarehouseOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Výchozí bod</Typography>
      </Stack>
      <Box sx={{ px: 2.5, py: 2 }}>
        {isError ? (
          <Typography variant="caption" color="error">
            Výchozí body se nepodařilo načíst.
          </Typography>
        ) : (
          <Select
            size="small"
            fullWidth
            inputProps={{ 'aria-label': 'Výchozí bod' }}
            disabled={disabled || isPending}
            value={isPending ? '' : optionKey(value)}
            onChange={(e) => {
              const picked = (data ?? []).find((p) => optionKey(p) === e.target.value);
              if (picked) {
                onChange({ kind: picked.kind ?? ShipmentStartPointKind.Company, breweryId: picked.breweryId });
              }
            }}
          >
            {(data ?? []).map((point) => (
              <MenuItem key={optionKey(point)} value={optionKey(point)}>
                {point.name}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  {point.address}
                </Typography>
              </MenuItem>
            ))}
          </Select>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Místo, kde se vůz naloží. Není zastávkou trasy.
        </Typography>
      </Box>
    </Card>
  );
}
