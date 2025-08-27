import React from "react";
import {useTranslation} from "react-i18next";

import Box from "@mui/material/Box";
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type TableToolbarProps = {
    numSelected: number;
    filters: React.ReactNode[];
};

export function TableToolbar(
    {
        numSelected,
        filters,
    }: Readonly<TableToolbarProps>) {
    const { t } = useTranslation();

    return (
        <Toolbar
            sx={{
                display: 'flex',
                justifyContent: 'space-between',
                p: (theme) => theme.spacing(0, 1, 0, 3),
                ...(numSelected > 0 && {
                    color: 'primary.main',
                    bgcolor: 'primary.lighter',
                }),
            }}
        >
            {numSelected > 0 ? (
                <Typography component="div" variant="subtitle1">
                    {t('table.selected')}: {numSelected}
                </Typography>
            ) : (
                <Box
                    sx={{
                        display: 'flex',
                        // gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                        gap: 2,
                        width: '100%',
                        mt: 2,
                        mb: 2
                    }}
                >
                    {filters.map((filter, index) => (
                        <React.Fragment key={index}>{filter}</React.Fragment>
                    ))}
                </Box>
            )}


        </Toolbar>
    );
}
