import React from 'react';
import {useTranslation} from 'react-i18next';
import {varAlpha} from "minimal-shared/utils";

import {Box, Button, Typography} from '@mui/material';
import LinearProgress, {linearProgressClasses} from "@mui/material/LinearProgress";

interface DrawerLayoutProps {
    title: string;
    isLoading: boolean;
    onClose: () => void;
    onSaveAndClose: () => void;
    children: React.ReactNode;
    width?: number;
}

export const DrawerLayout: React.FC<DrawerLayoutProps> = (
    {
        title,
        isLoading,
        onClose,
        onSaveAndClose,
        children,
        width
    }) => {
    const {t} = useTranslation();

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '95vh',
                maxWidth: width ?? 700,
                width: '100%',
                pl: 2,
                pr: 2,
                pt: 3
            }}
        >
            {/* Nadpis */}
            <Box sx={{flexShrink: 0}}>
                <Typography variant="h5" sx={{fontWeight: 'bold', borderBottom: '1px solid #eee'}}>
                    {title}
                </Typography>
            </Box>

            {/* Scrollovatelný obsah */}
            <Box
                sx={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    my: 3,
                    pr: 1, // prostor pro scrollbar
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                }}
            >
                {isLoading ?
                    <LinearProgress
                        sx={{
                            width: 1,
                            maxWidth: 320,
                            top: -25,
                            left: -30,
                            bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
                            [`& .${linearProgressClasses.bar}`]: {bgcolor: 'text.primary'},
                        }}
                    />
                    : children }
            </Box>

            {/* Spodní tlačítka */}
            <Box
                sx={{
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 2,
                    pt: 2,
                    borderTop: '1px solid #eee',
                }}
            >
                <Button variant="outlined" onClick={onClose}>
                    {t('common.close')}
                </Button>
                <Button variant="contained" onClick={onSaveAndClose}>
                    {t('common.saveAndClose')}
                </Button>
            </Box>
        </Box>
    );
};