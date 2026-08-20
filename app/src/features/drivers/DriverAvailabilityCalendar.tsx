import { useState } from 'react';
import { Box, Button, Card, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import dayjs from 'dayjs';
import { fmtTime } from 'src/lib/format';
import { type DriverListItemDto } from 'src/generated/api-client';

// Mirrors the prototype's `driverCalendarView`: a 7-day week starting today,
// a fixed 6:00-20:00 time grid, and one absolutely-positioned block per
// availability slot that falls on that day, tinted in the driver's color.
const START_HOUR = 6;
const END_HOUR = 20;
const COLUMN_HEIGHT = 460;
const HOURS = END_HOUR - START_HOUR;
const ROW_HEIGHT = COLUMN_HEIGHT / HOURS;

const fullName = (d: DriverListItemDto) => [d.firstName, d.lastName].filter(Boolean).join(' ');

/** Week time-grid of driver availability + a color legend below it. The visible
 * 7-day window is anchored on `anchor` (defaults to today) and can be moved by
 * week or month; "Dnes" jumps back to the current week. */
export function DriverAvailabilityCalendar({ drivers }: { drivers: DriverListItemDto[] }) {
  const realToday = dayjs().startOf('day');
  const [anchor, setAnchor] = useState(() => dayjs().startOf('day'));
  const days = Array.from({ length: 7 }, (_, i) => anchor.add(i, 'day'));
  const hourMarks = Array.from({ length: HOURS + 1 }, (_, i) => START_HOUR + i);
  const rangeLabel = `${days[0].toDate().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })} – ${days[6].toDate().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const isCurrentWeek = !realToday.isBefore(days[0], 'day') && !realToday.isAfter(days[6], 'day');

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<TodayOutlinedIcon />}
          onClick={() => setAnchor(dayjs().startOf('day'))}
          disabled={isCurrentWeek}
          sx={{ color: 'text.primary', borderColor: 'divider', '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } }}
        >
          Dnes
        </Button>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Předchozí měsíc"><IconButton size="small" onClick={() => setAnchor((a) => a.subtract(1, 'month'))} aria-label="Předchozí měsíc"><KeyboardDoubleArrowLeftIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Předchozí týden"><IconButton size="small" onClick={() => setAnchor((a) => a.subtract(7, 'day'))} aria-label="Předchozí týden"><ChevronLeftIcon fontSize="small" /></IconButton></Tooltip>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5, minWidth: 170, textAlign: 'center' }}>{rangeLabel}</Typography>
        <Tooltip title="Další týden"><IconButton size="small" onClick={() => setAnchor((a) => a.add(7, 'day'))} aria-label="Další týden"><ChevronRightIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Další měsíc"><IconButton size="small" onClick={() => setAnchor((a) => a.add(1, 'month'))} aria-label="Další měsíc"><KeyboardDoubleArrowRightIcon fontSize="small" /></IconButton></Tooltip>
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ display: 'flex', minWidth: 760 }}>
        {/* Hour label column */}
        <Box sx={{ width: 46, flex: '0 0 auto' }}>
          <Box sx={{ height: 53 }} />
          {hourMarks.map((h) => (
            <Box
              key={h}
              sx={{
                height: ROW_HEIGHT,
                fontSize: 10.5,
                color: 'text.disabled',
                textAlign: 'right',
                pr: 0.75,
                transform: 'translateY(-6px)',
              }}
            >
              {h}:00
            </Box>
          ))}
        </Box>

        {/* One column per day */}
        {days.map((day) => {
          const isToday = day.isSame(realToday, 'day');
          const dayDate = day.toDate();

          const blocks = drivers.flatMap((driver) =>
            (driver.availableDates ?? [])
              .filter((a) => a.from && dayjs(a.from).isSame(day, 'day'))
              .map((a, i) => {
                const from = a.from as Date;
                const until = a.until as Date;
                const fromHour = from.getHours() + from.getMinutes() / 60;
                const untilHour = until.getHours() + until.getMinutes() / 60;
                const top = Math.max(0, ((fromHour - START_HOUR) / HOURS) * COLUMN_HEIGHT);
                const height = Math.max(18, ((untilHour - fromHour) / HOURS) * COLUMN_HEIGHT);
                const color = driver.color ?? '#8791A0';
                return (
                  <Box
                    key={`${driver.id ?? fullName(driver)}-${i}`}
                    title={`${fullName(driver)} ${fmtTime(from)}–${fmtTime(until)}`}
                    sx={{
                      position: 'absolute',
                      left: 3,
                      right: 3,
                      top,
                      height,
                      bgcolor: alpha(color, 0.13),
                      borderLeft: `3px solid ${color}`,
                      borderRadius: '5px',
                      px: 0.65,
                      py: 0.4,
                      overflow: 'hidden',
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: 10.5,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {driver.lastName}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, color: 'text.secondary' }}>
                      {fmtTime(from)}–{fmtTime(until)}
                    </Typography>
                  </Box>
                );
              })
          );

          return (
            <Box
              key={day.format('YYYY-MM-DD')}
              sx={{ flex: 1, minWidth: 100, borderLeft: '1px solid', borderColor: 'divider' }}
            >
              <Box
                sx={{
                  textAlign: 'center',
                  px: 0.5,
                  py: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: isToday ? (t) => t.vars!.palette.brand.amberSoft : 'transparent',
                }}
              >
                <Typography sx={{ fontSize: 11, textTransform: 'uppercase', color: 'text.disabled', fontWeight: 700 }}>
                  {dayDate.toLocaleDateString('cs-CZ', { weekday: 'short' })}
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: 16,
                    fontVariantNumeric: 'tabular-nums',
                    color: isToday ? (t) => t.vars!.palette.brand.amberStrong : 'text.primary',
                  }}
                >
                  {day.date()}.
                </Typography>
              </Box>
              <Box sx={{ position: 'relative', height: COLUMN_HEIGHT }}>
                {hourMarks.slice(0, -1).map((h) => (
                  <Box
                    key={h}
                    sx={{ height: ROW_HEIGHT, borderBottom: '1px solid', borderColor: 'divider', opacity: 0.5 }}
                  />
                ))}
                {blocks}
              </Box>
            </Box>
          );
        })}
      </Box>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
        {drivers.map((d) => (
          <Box
            key={d.id ?? fullName(d)}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              height: 26,
              px: 1.25,
              borderRadius: 1,
              bgcolor: (t) => t.vars!.palette.brand.greyTint,
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: d.color ?? 'grey.400', flexShrink: 0 }} />
            {fullName(d)}
          </Box>
        ))}
      </Box>
    </Card>
  );
}
