import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { Chip, Select, InputLabel, FormControl } from '@mui/material';

type MultiSelectProps<T> = {
    label: string;
    labelId: string;
    items: T[];
    selectedIds: string[];
    getId: (item: T) => string;
    getLabel: (item: T) => string;
    onSelect: (ids: string[]) => void;
    shouldValidate?: boolean;
    disabled?: boolean;
    multiple?: boolean;
};

export function MultiSelect<T>({
    label,
    labelId,
    items,
    selectedIds,
    getId,
    getLabel,
    onSelect,
    shouldValidate,
    disabled,
    multiple = true,
}: Readonly<MultiSelectProps<T>>) {
    const hasError = shouldValidate && selectedIds.length === 0;

    const handleMenuItemClick = (id: string) => {
        if (multiple) return;
        onSelect(selectedIds[0] === id ? [] : [id]);
    };

    return (
        <FormControl fullWidth sx={{ mt: 1 }} error={hasError}>
            <InputLabel id={labelId}>{label}</InputLabel>
            <Select
                multiple={multiple}
                disabled={disabled}
                labelId={labelId}
                value={multiple ? selectedIds : (selectedIds[0] ?? '')}
                onChange={multiple ? (e) => onSelect(e.target.value as string[]) : undefined}
                renderValue={() => (
                    <Box sx={{
                        margin: 0,
                        display: 'flex',
                        flexWrap: 'nowrap',
                        gap: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        alignItems: 'center',
                    }}>
                        {selectedIds.map((id) => {
                            const item = items.find((i) => getId(i) === id);
                            return item ? (
                                <Chip key={id} label={getLabel(item)} size="small" sx={{ maxWidth: '100%' }} />
                            ) : null;
                        })}
                    </Box>
                )}
            >
                {items.map((item) => {
                    const id = getId(item);
                    return (
                        <MenuItem
                            key={id}
                            value={id}
                            onClick={!multiple ? () => handleMenuItemClick(id) : undefined}
                        >
                            <Checkbox checked={selectedIds.includes(id)} />
                            <ListItemText primary={getLabel(item)} />
                        </MenuItem>
                    );
                })}
            </Select>
        </FormControl>
    );
}
