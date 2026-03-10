import type { DriverListItemDto, DriverAvailabilityListItemDto } from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TodayIcon from '@mui/icons-material/Today';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { useDrivers, useUpdateDriver } from 'src/hooks/useDrivers';

import { apiClient } from 'src/api/apiClient';
import { UpdateDriverDto, UpdateDriverAvailabilityDto } from 'src/generated/api-client';

import EmptyState from 'src/components/common/EmptyState';
import SectionCard from 'src/components/common/SectionCard';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
     const r = new Date(d);
     r.setHours(0, 0, 0, 0);
     return r;
}

function startOfMonth(d: Date): Date {
     return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getDaysInMonth(d: Date): number {
     return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function addMonths(d: Date, n: number): Date {
     return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function isSameDay(a: Date, b: Date): boolean {
     return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(d: Date): string {
     return new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function getAvailabilityForDay(
     availableDates: DriverAvailabilityListItemDto[] | undefined,
     day: Date,
): DriverAvailabilityListItemDto | undefined {
     if (!availableDates) return undefined;
     const dayStart = startOfDay(day);
     return availableDates.find((avail) => {
          const from = startOfDay(new Date(avail.from!));
          const until = startOfDay(new Date(avail.until!));
          return dayStart >= from && dayStart <= until;
     });
}

function formatAvailabilityTooltip(
     driverName: string,
     avail: DriverAvailabilityListItemDto,
     day: Date,
): string {
     const from = new Date(avail.from!);
     const until = new Date(avail.until!);
     const isStartDay = isSameDay(startOfDay(day), startOfDay(from));
     const isEndDay = isSameDay(startOfDay(day), startOfDay(until));

     const parts = [driverName];
     if (isStartDay) parts.push(`${formatTime(from)} →`);
     if (isEndDay) parts.push(`→ ${formatTime(until)}`);
     if (!isStartDay && !isEndDay) parts.push('(celý den)');
     return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Popover state
// ---------------------------------------------------------------------------

interface PopoverState {
     anchorEl: HTMLElement;
     driver: DriverListItemDto;
     day: Date;
     fromTime: string;
     untilTime: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DriverAvailabilityCalendar() {
     const { t } = useTranslation();
     const theme = useTheme();
     const { data: drivers = [], isLoading } = useDrivers();
     const updateDriver = useUpdateDriver();

     const today = useMemo(() => startOfDay(new Date()), []);
     const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(today));
     const [popover, setPopover] = useState<PopoverState | null>(null);
     const [saving, setSaving] = useState(false);

     const days = useMemo(() => {
          const count = getDaysInMonth(currentMonth);
          return Array.from({ length: count }, (_, i) => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1));
     }, [currentMonth]);

     const driversWithAvailability = useMemo(
          () => drivers.filter((d) => d.availableDates && d.availableDates.length > 0),
          [drivers],
     );

     const monthLabel = currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

     const handlePrev = () => setCurrentMonth((m) => addMonths(m, -1));
     const handleNext = () => setCurrentMonth((m) => addMonths(m, 1));
     const handleToday = () => setCurrentMonth(startOfMonth(today));

     const isCurrentMonth = currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() === today.getMonth();

     const handleCellClick = useCallback((e: React.MouseEvent<HTMLElement>, driver: DriverListItemDto, day: Date) => {
          const avail = getAvailabilityForDay(driver.availableDates, day);
          const from = avail ? new Date(avail.from!) : day;
          const until = avail ? new Date(avail.until!) : day;
          const isStart = isSameDay(startOfDay(day), startOfDay(from));
          const isEnd = isSameDay(startOfDay(day), startOfDay(until));

          setPopover({
               anchorEl: e.currentTarget,
               driver,
               day,
               fromTime: isStart ? `${String(from.getHours()).padStart(2, '0')}:${String(from.getMinutes()).padStart(2, '0')}` : '06:00',
               untilTime: isEnd ? `${String(until.getHours()).padStart(2, '0')}:${String(until.getMinutes()).padStart(2, '0')}` : '18:00',
          });
     }, []);

     const handleClose = () => setPopover(null);

     const handleSave = useCallback(async () => {
          if (!popover) return;
          const { driver, day, fromTime, untilTime } = popover;

          setSaving(true);
          try {
               const detail = await apiClient.getDriverDetailEndpoint(driver.id!);

               const [fh, fm] = fromTime.split(':').map(Number);
               const [uh, um] = untilTime.split(':').map(Number);

               const fromDate = new Date(day);
               fromDate.setHours(fh, fm, 0, 0);
               const untilDate = new Date(day);
               untilDate.setHours(uh, um, 0, 0);

               const newAvail = new UpdateDriverAvailabilityDto();
               newAvail.from = fromDate;
               newAvail.until = untilDate;

               const existingDates = (detail.availableDates ?? []).map((a) => {
                    const dto = new UpdateDriverAvailabilityDto();
                    dto.from = a.from;
                    dto.until = a.until;
                    return dto;
               });

               // Check if this overlaps an existing availability on the same day
               const overlappingIdx = existingDates.findIndex((a) => {
                    const aFrom = startOfDay(new Date(a.from!));
                    const aUntil = startOfDay(new Date(a.until!));
                    const dayStart = startOfDay(day);
                    return dayStart >= aFrom && dayStart <= aUntil;
               });

               if (overlappingIdx >= 0) {
                    // Update the existing one's times for this day boundary
                    const existing = existingDates[overlappingIdx];
                    const existingFrom = new Date(existing.from!);
                    const existingUntil = new Date(existing.until!);

                    if (isSameDay(startOfDay(day), startOfDay(existingFrom))) {
                         existing.from = fromDate;
                    }
                    if (isSameDay(startOfDay(day), startOfDay(existingUntil))) {
                         existing.until = untilDate;
                    }
               } else {
                    existingDates.push(newAvail);
               }

               const dto = new UpdateDriverDto();
               dto.firstName = detail.firstName!;
               dto.lastName = detail.lastName!;
               dto.phoneNumber = detail.phoneNumber;
               dto.color = detail.color!;
               dto.availableDates = existingDates;

               await updateDriver.mutateAsync({ id: driver.id!, data: dto });
               setPopover(null);
          } finally {
               setSaving(false);
          }
     }, [popover, updateDriver]);

     return (
          <SectionCard
               title={t('drivers.availability')}
               action={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                         <IconButton size="small" onClick={handlePrev}>
                              <ChevronLeftIcon fontSize="small" />
                         </IconButton>
                         <Typography variant="subtitle2" sx={{ minWidth: 130, textAlign: 'center' }}>
                              {monthLabel}
                         </Typography>
                         <IconButton size="small" onClick={handleNext}>
                              <ChevronRightIcon fontSize="small" />
                         </IconButton>
                         <IconButton size="small" onClick={handleToday} sx={{ visibility: isCurrentMonth ? 'hidden' : 'visible' }}>
                              <TodayIcon fontSize="small" />
                         </IconButton>
                    </Box>
               }
          >
               {isLoading ? (
                    <LoadingSpinner />
               ) : driversWithAvailability.length === 0 ? (
                    <EmptyState />
               ) : (
                    <Box sx={{ overflowX: 'auto' }}>
                         <Box
                              sx={{
                                   display: 'grid',
                                   gridTemplateColumns: `120px repeat(${days.length}, minmax(32px, 1fr))`,
                                   minWidth: days.length * 32 + 120,
                                   border: '1px solid',
                                   borderColor: 'divider',
                                   borderRadius: 1,
                                   overflow: 'hidden',
                              }}
                         >
                              {/* Header row */}
                              <Box sx={{ position: 'sticky', left: 0, zIndex: 2, borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.neutral' }} />
                              {days.map((day) => {
                                   const isToday = isSameDay(day, today);
                                   const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                   return (
                                        <Box
                                             key={day.toISOString()}
                                             sx={{
                                                  textAlign: 'center',
                                                  py: 0.5,
                                                  bgcolor: isToday ? 'primary.main' : isWeekend ? 'action.hover' : 'background.neutral',
                                                  color: isToday ? 'primary.contrastText' : 'text.secondary',
                                                  borderRight: '1px solid',
                                                  borderBottom: '1px solid',
                                                  borderColor: 'divider',
                                                  '&:last-child': { borderRight: 0 },
                                             }}
                                        >
                                             <Typography variant="caption" sx={{ fontWeight: isToday ? 700 : 400, fontSize: '0.6rem' }}>
                                                  {day.toLocaleDateString(undefined, { weekday: 'narrow' })}
                                             </Typography>
                                             <Typography variant="caption" display="block" sx={{ fontWeight: isToday ? 700 : 400, fontSize: '0.65rem' }}>
                                                  {day.getDate()}
                                             </Typography>
                                        </Box>
                                   );
                              })}

                              {/* Driver rows */}
                              {driversWithAvailability.map((driver, driverIdx) => {
                                   const driverName = `${driver.firstName} ${driver.lastName}`;
                                   const isLastRow = driverIdx === driversWithAvailability.length - 1;
                                   return (
                                        <Box key={driver.id} sx={{ display: 'contents' }}>
                                             <Box
                                                  sx={{
                                                       position: 'sticky',
                                                       left: 0,
                                                       zIndex: 1,
                                                       bgcolor: 'background.paper',
                                                       display: 'flex',
                                                       alignItems: 'center',
                                                       px: 1,
                                                       minHeight: 36,
                                                       borderRight: '1px solid',
                                                       borderBottom: isLastRow ? 0 : '1px solid',
                                                       borderColor: 'divider',
                                                  }}
                                             >
                                                  <Box
                                                       sx={{
                                                            width: 8,
                                                            height: 8,
                                                            borderRadius: '50%',
                                                            bgcolor: driver.color || theme.palette.grey[400],
                                                            mr: 1,
                                                            flexShrink: 0,
                                                       }}
                                                  />
                                                  <Typography variant="caption" noWrap fontWeight={500}>
                                                       {driverName}
                                                  </Typography>
                                             </Box>
                                             {days.map((day) => {
                                                  const avail = getAvailabilityForDay(driver.availableDates, day);
                                                  const color = driver.color || theme.palette.primary.main;
                                                  const cellSx = {
                                                       minHeight: 36,
                                                       width: '100%',
                                                       borderRadius: 0,
                                                       borderRight: '1px solid',
                                                       borderBottom: isLastRow ? 0 : '1px solid',
                                                       borderColor: 'divider',
                                                       '&:last-child': { borderRight: 0 },
                                                       '&:hover': {
                                                            bgcolor: avail ? color + '55' : 'action.hover',
                                                       },
                                                       ...(avail && {
                                                            bgcolor: color + '33',
                                                       }),
                                                  };

                                                  const button = (
                                                       <ButtonBase
                                                            key={day.toISOString()}
                                                            sx={cellSx}
                                                            onClick={(e) => handleCellClick(e, driver, day)}
                                                       />
                                                  );

                                                  if (!avail) return button;

                                                  const tooltip = formatAvailabilityTooltip(driverName, avail, day);
                                                  return (
                                                       <Tooltip key={day.toISOString()} title={tooltip} arrow sx={{ whiteSpace: 'pre-line' }}>
                                                            {button}
                                                       </Tooltip>
                                                  );
                                             })}
                                        </Box>
                                   );
                              })}
                         </Box>
                    </Box>
               )}

               {/* Availability popover */}
               <Popover
                    open={!!popover}
                    anchorEl={popover?.anchorEl}
                    onClose={handleClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'center' }}
               >
                    {popover && (
                         <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 220 }}>
                              <Typography variant="subtitle2">
                                   {popover.driver.firstName} {popover.driver.lastName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                   {popover.day.toLocaleDateString()}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                   <TextField
                                        label={t('drivers.from')}
                                        type="time"
                                        size="small"
                                        value={popover.fromTime}
                                        onChange={(e) => setPopover((p) => p ? { ...p, fromTime: e.target.value } : null)}
                                        slotProps={{ inputLabel: { shrink: true } }}
                                        sx={{ flex: 1 }}
                                   />
                                   <Typography variant="body2">–</Typography>
                                   <TextField
                                        label={t('drivers.until')}
                                        type="time"
                                        size="small"
                                        value={popover.untilTime}
                                        onChange={(e) => setPopover((p) => p ? { ...p, untilTime: e.target.value } : null)}
                                        slotProps={{ inputLabel: { shrink: true } }}
                                        sx={{ flex: 1 }}
                                   />
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                   <Button size="small" onClick={handleClose}>
                                        {t('common.cancel')}
                                   </Button>
                                   <Button size="small" variant="contained" onClick={handleSave} disabled={saving}>
                                        {t('common.save')}
                                   </Button>
                              </Box>
                         </Box>
                    )}
               </Popover>
          </SectionCard>
     );
}
