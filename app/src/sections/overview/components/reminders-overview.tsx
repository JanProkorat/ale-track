import {useTranslation} from "react-i18next";
import {varAlpha} from "minimal-shared/utils";
import React, {useState, useEffect} from "react";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Popover from "@mui/material/Popover";
import ListItem from "@mui/material/ListItem";
import { EventNote } from "@mui/icons-material";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LinearProgress, {linearProgressClasses} from "@mui/material/LinearProgress";
import { List, IconButton, CardContent, ListItemIcon, ListItemText } from "@mui/material";

import {useRouter} from "../../../routes/hooks";
import {formatDate} from "../../../locales/formatDate";
import {Scrollbar} from "../../../components/scrollbar";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {SectionHeader} from "../../../components/label/section-header";

import type {ReminderBreweryDto, UpcomingReminderDto} from "../../../api/Client";

export function RemindersOverview() {
    const {t} = useTranslation();
    const {showSnackbar} = useSnackbar();
    const router = useRouter();

    const [loading, setLoading] = useState<boolean>(true);
    const [reminders, setReminders] = useState<ReminderBreweryDto[]>([]);

    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [selectedReminder, setSelectedReminder] = useState<UpcomingReminderDto | null>(null);

    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLElement>, reminder: UpcomingReminderDto) => {
        setAnchorEl(event.currentTarget);
        setSelectedReminder(reminder);
    };
    const handleClose = () => {
        setAnchorEl(null);
        setSelectedReminder(null);
    };

    useEffect(() => {
        fetchReminders()
    }, [])

    const fetchReminders = async () => {
        try {
            const client = new AuthorizedClient();
            await client.fetchRemindersOverview().then(setReminders);
            setLoading(false);
        } catch (error) {
            showSnackbar(t('reminders.fetchError'), 'error');
            console.error('Error fetching reminders:', error);
        }
    };

    return (
        <Card sx={{ minHeight: 400, maxHeight: 700 }}>
            <CardContent sx={{ height: "100%" }}>
                <SectionHeader text={t('reminders.title')} headerVariant="h6" />

                {loading ? (
                    <Box sx={{ height: 400, display: "flex", justifyContent: "center", alignItems: "center" }}>
                        <LinearProgress
                            sx={{
                                width: "50%",
                                bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
                                [`& .${linearProgressClasses.bar}`]: { bgcolor: "text.primary" },
                            }}
                        />
                    </Box>
                ) : (
                    <Scrollbar sx={{ height: "100%", ml: 1, mr: 1 }}>
                        <Box sx={{ mt: 2 }}>
                            {reminders.length === 0 && (
                                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', mt: 2 }}>
                                    {t('reminders.noUpcomingReminders')}
                                </Typography>
                            )}
                            {reminders.length > 0 && reminders.map((brewery) => (
                                <Box key={brewery.breweryId} sx={{ mb: 1 }}>
                                    <SectionHeader
                                        text={brewery.breweryName ?? ""}
                                        headerVariant="subtitle1"
                                        bottomLineVisible={false}
                                    >
                                        <IconButton onClick={() => router.push(`/breweries/${brewery.breweryId}`)} sx={{ ml: 1 }} size="small" aria-label="open" color="inherit">
                                            <OpenInNewIcon />
                                        </IconButton>
                                    </SectionHeader>
                                    <List sx={{ listStyleType: "disc", pl: 2 }}>
                                        {(brewery.reminders ?? []).map((reminder) => (
                                            <ListItem
                                                key={reminder.id}
                                                onClick={(e) => handleClick(e, reminder)}
                                                sx={{
                                                    cursor: 'pointer',
                                                    py: 0,
                                                    pl: 0,
                                                    backgroundColor: reminder.id === selectedReminder?.id ? (theme) => theme.palette.action.selected : undefined,
                                                    '&:hover': { backgroundColor: (theme) => theme.palette.action.hover }
                                                }}
                                            >
                                                <ListItemIcon>
                                                    <EventNote color="primary" />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={
                                                        <Typography variant="body1">
                                                            <strong>{formatDate(reminder.occurrenceDate!)}</strong>
                                                        </Typography>
                                                    }
                                                    secondary={reminder.name}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            ))}
                        </Box>
                    </Scrollbar>
                )}
                <Popover
                    open={open}
                    anchorEl={anchorEl}
                    onClose={handleClose}
                    anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                    transformOrigin={{vertical: 'bottom', horizontal: 'left'}}
                >
                    <Box sx={{minWidth: 300, p:2}}>
                        {selectedReminder && (
                            <>
                                <Box
                                    sx={[
                                        {
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            borderBottom: '1px solid #eee'
                                        },
                                    ]}
                                >
                                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                        {selectedReminder.name!}
                                    </Typography>
                                </Box>
                                <Scrollbar sx={{maxHeight: 500, overflow: 'auto', mb: 2}}>
                                    <Typography
                                        component="span"
                                        variant="body2"
                                        sx={{
                                            mt: 2,
                                            ml: 1,
                                            mr: 1,
                                            color: 'text.primary',
                                            display: 'block'
                                        }}
                                    >
                                        {selectedReminder.description}
                                    </Typography>
                                </Scrollbar>
                            </>
                        )}
                    </Box>
                </Popover>
            </CardContent>
        </Card>
    )
}