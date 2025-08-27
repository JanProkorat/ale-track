import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);
import { useTranslation } from 'react-i18next';
import React, { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import { Button, Popover } from '@mui/material';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import type {DriversProps} from "../drivers-table-row";

export function DriversAvailabilityCalendar({ drivers }: Readonly<{ drivers: DriversProps[] }>) {
    const { t } = useTranslation();
    const [viewMonth, setViewMonth] = useState(dayjs());

    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [selectedDriverInfo, setSelectedDriverInfo] = useState<{
        driver: DriversProps;
        date: dayjs.Dayjs;
        intervals: { from?: Date; until?: Date }[];
    } | null>(null);

    const startOfMonth = viewMonth.startOf('month');
    const endOfMonth = viewMonth.endOf('month');

    const startDay = startOfMonth.day() === 0 ? startOfMonth.subtract(6, 'day') : startOfMonth.startOf('week').add(1, 'day');
    const endDay = endOfMonth.day() === 0 ? endOfMonth : endOfMonth.add(7 - endOfMonth.day(), 'day');

    const dateRange: dayjs.Dayjs[] = [];
    let current = startDay;
    while (current.isBefore(endDay, 'day') || current.isSame(endDay, 'day')) {
        dateRange.push(current);
        current = current.add(1, 'day');
    }

    const getAvailableDrivers = (date: dayjs.Dayjs) => drivers.filter((driver) =>
            driver.availableDates?.some((interval) => {
                if (!interval.from || !interval.until) return false;
                const from = dayjs(interval.from);
                const until = dayjs(interval.until);
                return date.isSame(from, 'day') || date.isSame(until, 'day') || (date.isAfter(from, 'day') && date.isBefore(until, 'day'));
            })
        )

    const handleDriverClick = useCallback((event: React.MouseEvent<HTMLElement>, driver: DriversProps, date: dayjs.Dayjs) => {
        const intervals = driver.availableDates.filter(interval =>
            interval.from && interval.until &&
            dayjs(date).isBetween(dayjs(interval.from).startOf('day'), dayjs(interval.until).endOf('day'), null, '[]')
        );
        setSelectedDriverInfo({ driver, date, intervals });
        setAnchorEl(event.currentTarget);
    }, []);

    const handlePrevMonth = () => setViewMonth((prev) => prev.subtract(1, 'month'));
    const handleNextMonth = () => setViewMonth((prev) => prev.add(1, 'month'));

    return (
        <Box sx={{ maxWidth: 700, margin: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <IconButton onClick={handlePrevMonth}>
                    <ChevronLeftIcon />
                </IconButton>
                <Typography variant="h6">
                    {t(`months.${viewMonth.format('MMMM').toLowerCase()}`)} {viewMonth.format('YYYY')}
                </Typography>
                <IconButton onClick={handleNextMonth}>
                    <ChevronRightIcon />
                </IconButton>
            </Box>
            <Grid container spacing={1} columns={7}>
                {['P', 'Ú', 'S', 'Č', 'P', 'S', 'N'].map((label, i) => (
                    <Grid size={{xs: 1}} key={`label-${i}`}>
                        <Typography variant="subtitle2" align="center">
                            {label}
                        </Typography>
                    </Grid>
                ))}
                {dateRange.map((date) => {
                    const isOtherMonth = !date.isSame(viewMonth, 'month');
                    const driversForDay = getAvailableDrivers(date);
                    return (
                        <Grid size={{xs: 1}} key={date.toString()}>
                            <Paper
                                variant="outlined"
                                sx={{
                                    p: 1,
                                    minHeight: 80,
                                    backgroundColor: isOtherMonth ? '#f5f5f5' : undefined,
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    fontWeight="bold"
                                    color={isOtherMonth ? 'text.disabled' : 'text.primary'}
                                >
                                    {date.date()}
                                </Typography>
                                {driversForDay.map((d) => (
                                    <Button
                                        key={d.id}
                                        onClick={(e) => handleDriverClick(e, d, date)}
                                        sx={{
                                            display: 'block',
                                            backgroundColor: d.color,
                                            color: '#fff',
                                            borderRadius: 1,
                                            px: 0.5,
                                            fontSize: '0.7rem',
                                            mt: 0.3,
                                            textTransform: 'none',
                                            minWidth: 'unset',
                                            width: '100%',
                                            pt: 0.2,
                                            pb: 0.2
                                        }}
                                    >
                                        {d.firstName}
                                    </Button>
                                ))}
                            </Paper>
                        </Grid>
                    );
                })}
            </Grid>
            <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
                transformOrigin={{ vertical: 'center', horizontal: 'left' }}
            >
                {selectedDriverInfo && (
                    <Box sx={{ p: 2, maxWidth: 250 }}>
                       <>
                           <Typography variant="subtitle1" fontWeight="bold" sx={{borderBottom: '1px solid #eee'}}>
                               {selectedDriverInfo.driver.firstName} {selectedDriverInfo.driver.lastName}
                           </Typography>
                           <Typography variant="subtitle2" fontWeight="bold" sx={{mt: 1}}>
                               {t('drivers.available')}
                           </Typography>
                       </>
                        {selectedDriverInfo.intervals.length > 0 ? (
                            selectedDriverInfo.intervals.map((iv, i) => (
                                <Typography key={i} variant="body2">
                                    {dayjs(iv.from).format('HH:mm')} – {dayjs(iv.until).format('HH:mm')}
                                </Typography>
                            ))
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                {t('drivers.notAvailable')}
                            </Typography>
                        )}
                    </Box>
                )}
            </Popover>
        </Box>
    );
}