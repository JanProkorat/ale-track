import { useTranslation } from "react-i18next";

import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import {FormGroup, FormLabel, FormControl} from "@mui/material";

type DayOfMonthPickerProps = {
    selectedDays: number[];
    onDaysOfMonthPicked: (days: number[]) => void;
    errors: Record<string, string>;
}

export function DaysOfMonthPicker({selectedDays, onDaysOfMonthPicked, errors}: Readonly<DayOfMonthPickerProps>) {
    const {t} = useTranslation();
    const days = Array.from({length: 31}, (_, i) => i + 1);

    return (
        <FormControl
            required
            fullWidth
            error={!!errors.daysOfMonth}
            component="fieldset"
            sx={{
                border: '1px solid',
                borderColor: (theme) =>
                    errors.daysOfMonth
                        ? theme.palette.error.main
                        : theme.palette.grey[300],
                borderRadius: 1,
                p: 1,
                pl: 2
            }}
        >
            <FormLabel component="legend">{t('reminders.daysToDisplay')}</FormLabel>
            <FormGroup
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)'
                }}
            >
                {days.map(day => (
                    <FormControlLabel
                        key={day}
                        control={
                            <Checkbox
                                checked={selectedDays.includes(day)}
                                onChange={(event) => {
                                    const checked = event.target.checked;
                                    const updated = checked
                                        ? [...selectedDays, day]
                                        : selectedDays.filter(d => d !== day);
                                    onDaysOfMonthPicked(updated);
                                }}
                            />
                        }
                        label={day.toString()}
                        sx={{
                            color: errors.daysOfMonth ? 'error.main' : 'text.primary'
                        }}
                    />
                ))}
            </FormGroup>
        </FormControl>
    );
}