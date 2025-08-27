import type {Dayjs} from 'dayjs';

import dayjs from 'dayjs';
import React from 'react';
import {useTranslation} from 'react-i18next';

import TextField from "@mui/material/TextField";
import {DatePicker, TimePicker} from '@mui/x-date-pickers';
import {
    Box,
    List,
    Divider,
    ListItem,
    IconButton,
    Typography,
    ListItemText, FormHelperText
} from '@mui/material';

import {Iconify} from '../../../components/iconify';
import { DriverAvailabilityDto } from '../../../api/Client';

interface DriverAvailabilityEditorProps {
    availableDates: DriverAvailabilityDto[];
    onChange: (slots: DriverAvailabilityDto[]) => void;
}

export const DriverAvailabilityEditor: React.FC<DriverAvailabilityEditorProps> = (
    {
        availableDates,
        onChange
    }) => {
    const {t} = useTranslation();
    const pickerRef = React.useRef<any>(null);
    const [open, setOpen] = React.useState(false);

    const getOverlappingIndexes = (slots: DriverAvailabilityDto[]): Set<number> => {
        const overlaps = new Set<number>();

        for (let i = 0; i < slots.length; i++) {
            const a = slots[i];
            if (!a.from || !a.until) continue;

            for (let j = i + 1; j < slots.length; j++) {
                const b = slots[j];
                if (!b.from || !b.until) continue;

                const aFrom = a.from.getTime();
                const aUntil = a.until.getTime();
                const bFrom = b.from.getTime();
                const bUntil = b.until.getTime();

                const isOverlap = aFrom < bUntil && bFrom < aUntil;
                if (isOverlap) {
                    overlaps.add(i);
                    overlaps.add(j);
                }
            }
        }

        return overlaps;
    };

    const overlappingIndexes = getOverlappingIndexes(availableDates);

    const addDate = (date: Dayjs | null) => {
        if (date) {
            const dto = new DriverAvailabilityDto();
            dto.from = date.toDate();
            dto.until = date.toDate();
            dto.until.setHours(23, 59, 59, 0);
            onChange([...availableDates, dto]);
        }
    };

    const removeDate = (index: number) => {
        const updated = [...availableDates];
        updated.splice(index, 1);
        onChange(updated);
    };

    const updateTime = (index: number, field: 'from' | 'until', value: Dayjs | null) => {
        const updated = [...availableDates];
        updated[index] = new DriverAvailabilityDto({
            ...updated[index],
            [field]: value?.toDate()
        });
        onChange(updated);
    };

    return (
        <Box>
            <Typography variant="subtitle1" sx={{fontWeight: 'bold', mt: 2}}>
                {t('drivers.available')}
            </Typography>
            <Divider sx={{mt: 1, mb: 2}}/>
            <DatePicker
                disablePast
                ref={pickerRef}
                value={null}
                open={open}
                onOpen={() => setOpen(true)}
                onClose={() => setOpen(false)}
                onChange={(value) => {
                    addDate(value);
                    setOpen(false);
                }}
                enableAccessibleFieldDOMStructure={false}
                slots={{
                    textField: (params) => (
                        <TextField
                            {...params}
                            onFocus={(e) => {
                                params.inputProps?.onFocus?.(e);
                                setOpen(true);
                            }}
                            onBlur={() => {
                                setTimeout(() => {
                                    if (!pickerRef.current?.contains(document.activeElement)) {
                                        setOpen(false);
                                    }
                                }, 150);
                            }}
                            fullWidth
                            placeholder={t('common.selectDate')}
                        />
                    )
                }}
            />
            <List>
                {availableDates.map((slot, index) => (
                    <ListItem
                        key={index}
                        secondaryAction={
                            <IconButton edge="end" onClick={() => removeDate(index)}>
                                <Iconify icon="solar:trash-bin-trash-bold"/>
                            </IconButton>
                        }
                        sx={{
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: 1,
                            bgcolor: overlappingIndexes.has(index) ? 'rgba(255,0,0,0.08)' : undefined
                        }}
                    >
                        <Box display="flex" alignItems="center" gap={2} width="100%">
                          <ListItemText primary={dayjs(slot.from).format('DD. MM. YYYY')} />
                          {overlappingIndexes.has(index) && (
                            <FormHelperText error sx={{ m: 0 }}>
                              {t('common.overlappingIntervals')}
                            </FormHelperText>
                          )}
                        </Box>
                        <Box display="flex" gap={2} width="100%">
                            <TimePicker
                                label={t('common.from')}
                                value={slot.from ? dayjs(slot.from) : null}
                                onChange={(value) => updateTime(index, 'from', value)}
                            />
                            <TimePicker
                                label={t('common.until')}
                                value={slot.until ? dayjs(slot.until) : null}
                                onChange={(value) => updateTime(index, 'until', value)}
                            />
                        </Box>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
};