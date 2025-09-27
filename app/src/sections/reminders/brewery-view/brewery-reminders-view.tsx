import {useTranslation} from "react-i18next";
import React, {useState, useEffect, useCallback} from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemButton from "@mui/material/ListItemButton";
import {Tab, List, Tabs, Typography, ListItemText} from "@mui/material";
import CheckCircleTwoToneIcon from '@mui/icons-material/CheckCircleTwoTone';

import {useSnackbar} from "src/providers/SnackbarProvider";

import {Iconify} from "../../../components/iconify";
import {formatDate} from "../../../locales/formatDate";
import {Scrollbar} from "../../../components/scrollbar";
import {mapEnumValue} from "../../../utils/format-enum-value";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {sortDaysOfWeek} from "../../../utils/sort-daysof-week";
import {sortReminders} from "../detail-view/utils/sort-reminders";
import {CreateReminderView} from "../detail-view/create-reminder-view";
import {SectionHeader} from "../../../components/label/section-header";
import {UpdateReminderView} from "../detail-view/update-reminder-view";
import {CollapsibleForm} from "../../../components/forms/collapsible-form";
import {
    ReminderType,
    BreweryReminderDto,
    ReminderRecurrenceType,
    SetReminderResolvedDateRequest
} from "../../../api/Client";

type BreweryRemindersProps = {
    breweryId: string;
};

export function BreweryRemindersView({breweryId}: Readonly<BreweryRemindersProps>) {
    const {t} = useTranslation();
    const {showSnackbar} = useSnackbar();

    const [reminders, setReminders] = useState<BreweryReminderDto[]>([]);
    const [filteredReminders, setFilteredReminders] = useState<BreweryReminderDto[]>([]);
    const [selectedReminderId, setSelectedReminderId] = useState<string | null | undefined>(undefined);
    const [selectedReminder, setSelectedReminder] = useState<BreweryReminderDto | null>(null);
    const [selectedType, setSelectedType] = useState<ReminderType>(ReminderType.OneTimeEvent);

    useEffect(() => {
        void fetchReminders().then((data) => setReminders(data))
    }, [breweryId]);

    const fetchReminders = useCallback(async () => {
        try {
            const clientApi = new AuthorizedClient();

            return await clientApi.fetchRemindersForBrewery(breweryId, {}).then((data) => {
                const mapped = data.map(r => new BreweryReminderDto({
                    ...r,
                    type: ReminderType[r.type! as unknown as keyof typeof ReminderType]
                }));
                return mapped;

            });
        } catch (error) {
            console.error('Error fetching reminders:', error);
            showSnackbar(t('reminders.fetchError'), 'error');
            return [];
        }
    }, [breweryId, showSnackbar, t]);

    useEffect(() => {
        let type = selectedType;
        let filteredData = reminders.filter(reminder => reminder.type === type);
        if (filteredData.length === 0) {
            const otherType = type === ReminderType.Regular ? ReminderType.OneTimeEvent : ReminderType.Regular;
            filteredData = reminders.filter(reminder => reminder.type === otherType);
            if (filteredData.length > 0) {
                type = otherType;
            }
        }

        setFilteredReminders(filteredData);

        if (type !== selectedType)
            setSelectedType(type);

        if (!selectedReminder || !filteredData.find(r => r.id === selectedReminder.id)) {
            setSelectedReminder(filteredData.length > 0 ? filteredData[0] : null);
        }

    }, [reminders]);

    useEffect(() => {
        const filteredData = reminders.filter(reminder => reminder.type === selectedType);
        setFilteredReminders(filteredData)
        setSelectedReminder(filteredData.length > 0 ? filteredData[0] : null);
    }, [selectedType])

    const closeDrawer = (shouldRefresh: boolean) => {
        if (!shouldRefresh) {
            setSelectedReminderId(undefined);
            return;
        }

        fetchReminders().then((data) => {
            setReminders(data);
            if (selectedReminderId !== undefined && selectedReminderId !== null) {
                const filteredData = data.filter(reminder => reminder.id === selectedReminderId);
                if (filteredData.length > 0) {
                    setSelectedReminder(filteredData[0]);
                }
            } else {
                setSelectedReminder(null);
            }
            setSelectedReminderId(undefined);
        });
    }

    const resolveReminder = async (id: string, isResolved: boolean) => {
        const originalReminders = filteredReminders;
        const updatedReminders: BreweryReminderDto[] = [];

        originalReminders.map(reminder => {
            if (reminder.id === id)
                reminder.isResolved = !isResolved

            updatedReminders.push(reminder);
        });
        setFilteredReminders(sortReminders(updatedReminders));

        try {
            const clientApi = new AuthorizedClient();
            await clientApi.setReminderResolvedDateEndpoint(id, new SetReminderResolvedDateRequest({
                resolvedDate: isResolved ? undefined : new Date
            }));
        } catch (error) {
            console.error('Error saving reminder resolved date:', error);
            showSnackbar(t('reminders.saveError'), 'error');
            setFilteredReminders(originalReminders);
        }
    }

    const deleteReminder = async (id: string) => {
        try {
            const clientApi = new AuthorizedClient();
            await clientApi.deleteReminderEndpoint(id).then(() => {
                showSnackbar(t('reminders.deleteSuccess'), 'success');
                setReminders(prevReminders => {
                    const newReminders = prevReminders.filter(reminder => reminder.id !== id);
                    // If deleted reminder was selectedReminder, update selectedReminder
                    if (selectedReminder && selectedReminder.id === id) {
                        const newFiltered = newReminders.filter(reminder => reminder.type === selectedType);
                        setSelectedReminder(newFiltered.length > 0 ? newFiltered[0] : null);
                    }
                    return newReminders;
                });
            });
        } catch (error) {
            console.error('Error while deleting reminder:', error);
            showSnackbar(t('reminders.saveError'), 'error');
        }
    }

    const newButton = (visible: boolean) => (
        <Box sx={{display: 'flex', alignItems: 'center'}}>
            <Button
                variant="contained"
                color="inherit"
                startIcon={<Iconify icon="mingcute:add-line"/>}
                size="small"
                sx={{
                    mb: 1,
                    mt: 1,
                    visibility: visible ? 'visible' : 'hidden'
                }}
                onClick={() => setSelectedReminderId(null)}
            >
                {t('reminders.new')}
            </Button>
        </Box>
    );

    const noDataBox = (
        <Box sx={{py: 5, textAlign: 'center', width: '100%'}}>
            <Typography variant="h6" sx={{mb: 1}}>
                {t('reminders.noDataTitle')}
            </Typography>

            <Typography variant="body2" whiteSpace="pre-line">
                {t('reminders.noDataMessage')}
            </Typography>
            <Box sx={{mt: 2, display: 'flex', justifyContent: 'center'}}>
                {newButton(filteredReminders.length === 0)}
            </Box>
        </Box>
    );

    const reminderHeaderLabel = (reminder: BreweryReminderDto) => {
        if (reminder.type === ReminderType.OneTimeEvent) {
            return `${formatDate(reminder.occurrenceDate!)} - ${reminder.name}`;
        }

        return `${reminder.name}`;
    }

    return (
        <CollapsibleForm title={t('reminders.title')} headerChildren={newButton(filteredReminders.length > 0)}>
            {reminders.length === 0 ? noDataBox :
                <Box display="flex" height="100%">
                    <Box flex={1} mr={2}>
                        <Tabs
                            value={selectedType}
                            onChange={(_, newValue) => setSelectedType(newValue)}
                            textColor="secondary"
                            indicatorColor="secondary"
                            variant="fullWidth"
                        >
                            {Object.keys(ReminderType)
                                .filter(key => isNaN(Number(key)))
                                .map((type) => (
                                    <Tab
                                        key={type}
                                        value={ReminderType[type as keyof typeof ReminderType]}
                                        label={t('reminderType.' + type)}
                                    />
                                ))}
                        </Tabs>
                        <Box sx={{minHeight: 200, maxHeight: 500, overflow: 'auto', mb: 2}}>
                            {filteredReminders.length === 0 ? noDataBox :
                                <Scrollbar>
                                    <List>
                                        {filteredReminders.map((reminder, index) => (
                                            <ListItemButton
                                                key={reminder.id!}
                                                alignItems="flex-start"
                                                divider={index !== reminders.length - 1}
                                                selected={selectedReminder?.id === reminder.id}
                                                sx={{pt: 0, pb: 0}}
                                                onClick={() => setSelectedReminder(reminder)}   // <<< tady
                                            >
                                                <IconButton
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // zabrání, aby kliknutí na ikonu rovnou měnilo selection
                                                        resolveReminder(reminder.id!, reminder.isResolved!)
                                                    }}
                                                    sx={{ p: 2 }}
                                                >
                                                    <CheckCircleTwoToneIcon
                                                        sx={{color: reminder.isResolved ? '#4caf50' : undefined}}/>
                                                </IconButton>
                                                <ListItemText
                                                    sx={{ml: 1, mt: 2}}
                                                    primary={reminderHeaderLabel(reminder)}
                                                    slotProps={{
                                                        primary: {
                                                            sx: {
                                                                fontWeight: 'bold',
                                                                display: 'block',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                textDecoration: reminder.isResolved ? 'line-through' : 'none'
                                                            }
                                                        }
                                                    }}
                                                />
                                            </ListItemButton>
                                        ))}
                                    </List>
                                </Scrollbar>
                            }
                        </Box>
                    </Box>

                    <Divider orientation="vertical" flexItem/>

                    <Box flex={1} ml={2}>
                        {selectedReminder !== null &&
                            <Box>
                                <SectionHeader text={selectedReminder.name!} headerVariant="h6" bold={false}>
                                    <Box sx={{display: 'flex', alignItems: 'center'}}>
                                        <IconButton onClick={() => setSelectedReminderId(selectedReminder!.id!)}>
                                            <Iconify icon="solar:pen-bold"/>
                                        </IconButton>
                                        <IconButton
                                            onClick={() => deleteReminder(selectedReminder!.id!)}
                                            color="error"
                                        >
                                            <Iconify icon="solar:trash-bin-trash-bold"/>
                                        </IconButton>
                                    </Box>
                                </SectionHeader>
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
                                        {selectedReminder.type === ReminderType.Regular &&
                                            <Box sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <Typography variant="body2" sx={{ml: 1}}>{t('reminders.days')}:</Typography>
                                                <Typography variant="body2" sx={{ml: 2, mr: 1}}>
                                                    {mapEnumValue(ReminderRecurrenceType, selectedReminder.recurrenceType) === ReminderRecurrenceType.Weekly &&
                                                        sortDaysOfWeek(selectedReminder?.daysOfWeek ?? [])
                                                            .map((dayName) => t(`dayOfWeekShort.${dayName}`))
                                                            .join(", ")
                                                    }
                                                    {mapEnumValue(ReminderRecurrenceType, selectedReminder.recurrenceType) === ReminderRecurrenceType.Monthly &&
                                                        (selectedReminder?.daysOfMonth ?? [])
                                                            .map((dayName) =>`${dayName}.`)
                                                            .join(", ")
                                                    }
                                                </Typography>
                                            </Box>
                                        }
                                    </Typography>
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
                            </Box>}
                    </Box>
                </Box>}
            <Drawer
                anchor="right"
                open={selectedReminderId !== undefined}
                onClose={closeDrawer}
            >
                <Box sx={{width: 700, p: 2}}>
                    {selectedReminderId === null ?
                        <CreateReminderView breweryId={breweryId} onClose={closeDrawer} selectedType={selectedType}/> :
                        <UpdateReminderView reminderId={selectedReminderId!} onClose={closeDrawer}/>
                    }
                </Box>
            </Drawer>
        </CollapsibleForm>
    );
}