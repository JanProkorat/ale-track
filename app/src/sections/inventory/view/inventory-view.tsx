import {useTranslation} from "react-i18next";
import React, {useState, useEffect} from "react";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import {Card, Collapse} from "@mui/material";
import Typography from "@mui/material/Typography";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

import {Iconify} from "../../../components/iconify";
import {InventoryItemView} from "./inventory-item-view";
import {DashboardContent} from "../../../layouts/dashboard";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";

import type {InventorySectionDto} from "../../../api/Client";

export function InventoryView() {
    const {t} = useTranslation();
    const {showSnackbar} = useSnackbar();

    const [inventorySections, setInventorySections] = useState<InventorySectionDto[]>([])
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    useEffect(() => {
        void fetchInventoryItems();
    }, []);

    const fetchInventoryItems = async () => {
        try {
            const client = new AuthorizedClient();
            const data = await client.fetchInventoryItems({});
            const sortedData = [...data].sort((a, b) => a.name!.localeCompare(b.name!));
            setInventorySections(sortedData);
            setExpandedSections(data.reduce((acc, section) => ({ ...acc, [section.id as string]: true }), {}));
        } catch (e) {
            showSnackbar('inventory.fetchError', 'error');
            console.error('Error fetching inventory items', e);
        }
    }

    return (
        <DashboardContent>
            <Box
                sx={{
                    mb: 5,
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                <Typography variant="h4" sx={{flexGrow: 1}}>
                    {t('inventory.title')}
                </Typography>
                <Button
                    variant="contained"
                    color="inherit"
                    startIcon={<Iconify icon="mingcute:add-line"/>}
                    onClick={() => {}}
                >
                    {t('inventory.new')}
                </Button>
            </Box>
            <Box >
                {inventorySections.map((section) =>
                <>
                    <Button
                        variant="text"
                        fullWidth
                        onClick={() => setExpandedSections(prev => ({ ...prev, [section.id as string]: !prev[section.id as string] }))}
                        sx={{ mb: 2, p: 0 }}
                    >
                        <Card sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}>
                            <Typography variant="h6" sx={{flexGrow: 1, m: 2, textAlign: 'left'}}>
                                {section.name}
                            </Typography>
                            <Box sx={{display: 'flex', alignItems: 'center', mr: 2}}>
                                {expandedSections[section.id as string] ? <KeyboardArrowUpIcon/> : <KeyboardArrowDownIcon/>}
                            </Box>
                        </Card>
                    </Button>

                    <Collapse in={expandedSections[section.id as string]} sx={{ml: 2, mr: 2}}>
                        <Grid container spacing={3} sx={{mb: 3}}>
                            {(section.items ?? []).map((product) => (
                                <Grid key={product.id} size={{ xs: 12, sm: 6, md: 3 }}>
                                    <InventoryItemView item={product} />
                                </Grid>
                            ))}
                        </Grid>
                    </Collapse>
                </>
                )}
            </Box>
        </DashboardContent>
    )
}
