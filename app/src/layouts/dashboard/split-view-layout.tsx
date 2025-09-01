import React from "react";
import {varAlpha} from "minimal-shared/utils";

import Drawer from "@mui/material/Drawer";
import {linearProgressClasses} from "@mui/material/LinearProgress";
import {Box, Card, Button, Typography, LinearProgress} from "@mui/material";

import {Iconify} from "src/components/iconify";

import {DashboardContent} from "./content";

interface SplitViewLayoutProps {
    title: string;
    newLabel: string;
    onNewClick: () => void;
    rightContent: React.ReactNode;
    leftContent?: React.ReactNode;
    drawerOpen?: boolean;
    onDrawerClose?: () => void;
    drawerContent?: React.ReactNode;
    initialLoading: boolean;
    leftContentWidth?: number;
    leftContentMaxWidth?: number;
    minHeight?: number;
    drawerWidth?: number;
}

export function SplitViewLayout(
    {
        title,
        newLabel,
        onNewClick,
        rightContent,
        leftContent,
        drawerOpen,
        onDrawerClose,
        drawerContent,
        initialLoading,
        leftContentWidth,
        leftContentMaxWidth,
        minHeight,
        drawerWidth
    }: Readonly<SplitViewLayoutProps>) {
    return (
        <DashboardContent>
            <Box sx={{mb: 5, display: 'flex', alignItems: 'center'}}>
                <Typography variant="h4" sx={{flexGrow: 1}}>
                    {title}
                </Typography>
                <Button
                    variant="contained"
                    color="inherit"
                    startIcon={<Iconify icon="mingcute:add-line"/>}
                    onClick={onNewClick}
                >
                    {newLabel}
                </Button>
            </Box>

            <Box sx={{display: 'flex'}}>
                {leftContent && <Box sx={{
                    width: leftContentWidth ? leftContentWidth +'%' : '20%',
                    maxWidth: leftContentMaxWidth ? leftContentMaxWidth + '%' : undefined,
                    pr: 2}}>
                    <Card>
                        {leftContent}
                    </Card>
                </Box>}

                <Box sx={{flexGrow: 1}}>
                    <Box sx={{ position: 'relative', alignItems: "center" }}>
                        {initialLoading && (
                            <LinearProgress
                                sx={{
                                    zIndex: 1,
                                    position: 'absolute',
                                    top: 190,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: '40%',
                                    bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
                                    [`& .${linearProgressClasses.bar}`]: { bgcolor: 'text.primary' },
                                }}
                            />
                        )}
                        <Card sx={{ display: 'flex', flexDirection: 'column', p: 3, minHeight: minHeight ?? 800 }}>
                            {rightContent}
                        </Card>
                    </Box>
                </Box>
            </Box>

            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={onDrawerClose}
            >
                <Box sx={{width: drawerWidth ?? 700, p: 2}}>
                    {drawerContent}
                </Box>
            </Drawer>
        </DashboardContent>
    );
}
