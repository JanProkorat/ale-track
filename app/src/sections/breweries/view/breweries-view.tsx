import {useTranslation} from "react-i18next";
import {varAlpha} from "minimal-shared/utils";
import React, {useState, useEffect} from 'react';
import {useParams, useNavigate} from "react-router-dom";

import Card from "@mui/material/Card";
import Drawer from "@mui/material/Drawer";
import {linearProgressClasses} from "@mui/material/LinearProgress";
import {Box, Tab, Tabs, Button, Typography, LinearProgress} from "@mui/material";

import {BreweryDetailView} from "../detail-view";
import {Iconify} from "../../../components/iconify";
import {DashboardContent} from "../../../layouts/dashboard";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {BreweryDetailCard} from "../detail-view/brewery-detail-card";

import type {BreweryListItemDto} from "../../../api/Client";

// ----------------------------------------------------------------------

export function BreweriesView() {
    const {showSnackbar} = useSnackbar();
    const {t} = useTranslation();

    const { breweryId } = useParams<{ breweryId?: string }>();
    const navigate = useNavigate();

    const [initialLoading, setInitialLoading] = useState<boolean>(true);
    const [breweries, setBreweries] = useState<BreweryListItemDto[]>([]);
    const [selectedBreweryId, setSelectedBreweryId] = useState<string | null>(breweryId ?? null);
    const [createBreweryDrawerVisible, setCreateBreweryDrawerVisible] = useState<boolean>(false);
    const [hasDetailChanges, setHasDetailChanges] = useState<boolean>(false);
    const [pendingBreweryId, setPendingBreweryId] = useState<string | null>(null);

    useEffect(() => {
        const loadInitial = async () => {
            const loaded = await fetchBreweries();
            setBreweries(loaded);
            if (loaded.length > 0) {
                if (breweryId) {
                    const exists = loaded.some(b => b.id === breweryId);
                    if (exists) {
                        setSelectedBreweryId(breweryId);
                    } else {
                        const firstId = loaded[0].id!;
                        setSelectedBreweryId(firstId);
                        navigate(`/breweries/${firstId}`, { replace: true });
                    }
                } else {
                    const firstId = loaded[0].id!;
                    setSelectedBreweryId(firstId);
                    navigate(`/breweries/${firstId}`, { replace: true });
                }
            } else {
                setSelectedBreweryId(null);
            }
            setInitialLoading(false);
        };
        void loadInitial();
    }, []);

    useEffect(() => {
        if (breweryId) setSelectedBreweryId(breweryId);
    }, [breweryId]);

    const fetchBreweries = async () => {
        try {
            const client = new AuthorizedClient();
            return await client.fetchBreweries({});
        } catch (error) {
            showSnackbar('Error fetching breweries', 'error');
            console.error('Error fetching breweries:', error);
            return [];
        }
    };

    const closeDrawer = () => {
        fetchBreweries().then(setBreweries);
        setCreateBreweryDrawerVisible(false);
    }

    const handleDisplayedBreweryChange = (shouldLoadNewData: boolean) => {
        if (shouldLoadNewData) {
            fetchBreweries().then(newBreweries => {
                setBreweries(newBreweries);
                if (pendingBreweryId !== null) {
                    setSelectedBreweryId(pendingBreweryId);
                }
            });
        }
        setPendingBreweryId(null);
    };

    const handleAfterDeletingBrewery = async () => {
        await fetchBreweries().then((newData) => {
            setBreweries(newData);
            setSelectedBreweryId(newData.length > 0 ? newData[0].id! : null);
        })
    }

    const handleBreweryChange = (id: string) => {
        if (hasDetailChanges) {
            setPendingBreweryId(id);
        } else {
            setSelectedBreweryId(id);
            navigate(`/breweries/${id}`);
        }
    };

    return (
        <DashboardContent>
            <Box sx={{mb: 5, display: 'flex', alignItems: 'center'}}>
                <Typography variant="h4" sx={{flexGrow: 1}}>
                    {t('breweries.title')}
                </Typography>
                <Button
                    variant="contained"
                    color="inherit"
                    startIcon={<Iconify icon="mingcute:add-line"/>}
                    onClick={() => setCreateBreweryDrawerVisible(true)}
                >
                    {t('breweries.new')}
                </Button>
            </Box>

            <Box sx={{display: 'flex'}}>
                <Box sx={{flexGrow: 1}}>
                    <Box sx={{position: 'relative', alignItems: "center"}}>
                        {initialLoading ? (
                                <LinearProgress
                                    sx={{
                                        zIndex: 1,
                                        position: 'absolute',
                                        top: 190,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: '40%',
                                        bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
                                        [`& .${linearProgressClasses.bar}`]: {bgcolor: 'text.primary'},
                                    }}
                                />
                            ) :
                            <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                                {breweries.length === 0 ? <div>no items placeholder</div> :
                                    <>
                                        <Card sx={{p: 2}}>
                                            <Tabs
                                                value={selectedBreweryId}
                                                onChange={(_, newValue) => handleBreweryChange(newValue)}
                                                textColor="secondary"
                                                indicatorColor="secondary"
                                                variant="fullWidth"
                                                slotProps={{
                                                        indicator: {
                                                            style: {
                                                                backgroundColor: breweries.find(b => b.id === selectedBreweryId)?.color || 'inherit'
                                                            }
                                                        }
                                                    }}
                                            >
                                                {breweries.map((brewery) => (
                                                    <Tab key={brewery.id} value={brewery.id} label={brewery.name}/>
                                                ))}
                                            </Tabs>
                                        </Card>
                                        <Card sx={{p: 3}}>
                                            <BreweryDetailCard
                                                id={selectedBreweryId}
                                                onDelete={handleAfterDeletingBrewery}
                                                onHasChangesChange={setHasDetailChanges}
                                                shouldCheckPendingChanges={pendingBreweryId !== null}
                                                onConfirmed={handleDisplayedBreweryChange}
                                                onProgressbarVisibilityChange={setInitialLoading}
                                            />
                                        </Card>
                                    </>
                                }
                            </Box>}
                    </Box>
                </Box>
            </Box>

            <Drawer
                anchor="right"
                open={createBreweryDrawerVisible}
                onClose={closeDrawer}
            >
                <Box sx={{width: 700, p: 2}}>
                    <BreweryDetailView onClose={closeDrawer}/>
                </Box>
            </Drawer>
        </DashboardContent>
    );
}