import React from "react";
import dayjs from "dayjs";
import { useTranslation } from 'react-i18next';

import Box from "@mui/material/Box";
import {IconButton} from "@mui/material";
import TextField from "@mui/material/TextField";
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import {Iconify} from "../../components/iconify";
import {TableToolbar} from "../../components/table/table-toolbar";

type ProductDeliveriesToolbarProps = {
    numSelected: number;
    filterDate: Date | null;
    onFilterDate: (newDate: string | null) => void;
};

export function ProductDeliveriesTableToolbar(
    {
        numSelected,
        filterDate,
        onFilterDate,
    }: Readonly<ProductDeliveriesToolbarProps>) {
    const { t } = useTranslation();
    const pickerRef = React.useRef<any>(null);
    const [open, setOpen] = React.useState(false);

    const filters = [
        <Box key="filterBox" sx={{display: 'flex', alignItems: 'center', width: '100%'}}>
            <DatePicker
                key="date"
                disablePast
                ref={pickerRef}
                value={filterDate !== null ? dayjs(filterDate) : null}
                open={open}
                onOpen={() => setOpen(true)}
                onClose={() => setOpen(false)}
                onChange={(value) => {
                    onFilterDate(value != null ? value.format('YYYY-MM-DD') : null);
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
                            placeholder={t('productDeliveries.date')}
                        />
                    )
                }}
            />
            <Box sx={{
                position: 'absolute',
                right: 60,
                top: 25,
                zIndex: 10,
                pointerEvents: 'auto',
            }}>
                <IconButton
                    key="clear"
                    color="inherit"
                    size="medium"
                    onClick={() => onFilterDate(null)}
                    sx={{ml: 1, display: filterDate !== null ? 'block' : 'none'}}
                >
                    <Iconify icon="solar:close-bold"/>
                </IconButton>
            </Box>
        </Box>
    ];

    return <TableToolbar numSelected={numSelected} filters={filters}/>;
}
