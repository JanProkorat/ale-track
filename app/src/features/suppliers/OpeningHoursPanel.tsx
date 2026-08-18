import { Box, Button, Card, Chip, Stack, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
import ScheduleIcon from '@mui/icons-material/ScheduleOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonthOutlined';
import { StatusPill } from 'src/components/common/StatusPill';
import { plural } from 'src/lib/format';
import { type SupplierOpeningHoursDto } from 'src/generated/api-client';
import {
  hm, hoursOfDay, hoursText, isNonstop, openBadgeText, openState, openStateText, weekdayIdx,
  WEEKDAYS_LONG,
} from './supplierHours';

/**
 * The Otevírací doba tab: what the answer is right now, then the week it comes from.
 *
 * `now` is injected so the panel renders deterministically in tests. In the app it is the
 * viewer's own clock, which is the whole point — this question is about the reader's
 * moment, not the server's.
 */
export function OpeningHoursPanel({
  hours,
  editable,
  onEdit,
  now = new Date(),
}: {
  hours: SupplierOpeningHoursDto[];
  editable: boolean;
  onEdit: () => void;
  now?: Date;
}) {
  const state = openState(hours, now);
  const today = weekdayIdx(now);
  const intervalCount = hours.length;

  return (
    <Stack spacing={2}>
      <Card sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <Box
            sx={{
              width: 46, height: 46, borderRadius: 2, display: 'grid', placeItems: 'center', flexShrink: 0,
              bgcolor: (t) => (state.open ? t.vars!.palette.brand.okTint : t.vars!.palette.brand.greyTint),
              color: state.open ? 'success.main' : 'text.secondary',
              '& svg': { fontSize: 22 },
            }}
          >
            <ScheduleIcon />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <StatusPill tone={state.open ? 'ok' : 'grey'} label={openBadgeText(state)} />
              <Typography sx={{ fontWeight: 700 }}>{openStateText(state)}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Dnes {hoursText(hoursOfDay(hours, today))}
            </Typography>
          </Box>
          {editable && (
            <Button size="small" startIcon={<EditIcon />} onClick={onEdit} color="inherit">
              Upravit dobu
            </Button>
          )}
        </Stack>
      </Card>

      <Card>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2.5, py: 2 }}>
          <Box sx={{ color: 'text.disabled', display: 'flex', '& svg': { fontSize: 18 } }}>
            <CalendarMonthIcon />
          </Box>
          <Typography sx={{ fontWeight: 700 }}>Týdenní rozpis</Typography>
          <Typography variant="body2" color="text.secondary">
            {intervalCount > 0
              ? `${intervalCount} ${plural(intervalCount, 'interval', 'intervaly', 'intervalů')} — den bez intervalu je zavřeno.`
              : 'Zatím nezadaná — dodavatel se zobrazuje jako zavřený.'}
          </Typography>
        </Stack>
        <Table size="small">
          <TableBody>
            {WEEKDAYS_LONG.map((label, day) => {
              const dayHours = hoursOfDay(hours, day);
              const isToday = day === today;
              return (
                <TableRow
                  key={label}
                  sx={{ bgcolor: isToday ? (t) => t.vars!.palette.brand.amberTint : undefined }}
                >
                  <TableCell sx={{ width: 200 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
                      {isToday && <Chip size="small" label="dnes" color="primary" variant="outlined" />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {dayHours.length === 0 ? (
                      <Typography color="text.secondary">zavřeno</Typography>
                    ) : isNonstop(dayHours) ? (
                      <Chip size="small" variant="outlined" icon={<ScheduleIcon />} label="nonstop" />
                    ) : (
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        {dayHours.map((h, i) => (
                          <Chip
                            key={i}
                            size="small"
                            variant="outlined"
                            icon={<ScheduleIcon />}
                            label={`${hm(h.from)}–${hm(h.to)}`}
                          />
                        ))}
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </Stack>
  );
}
