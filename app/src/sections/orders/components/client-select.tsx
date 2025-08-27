import {useTranslation} from "react-i18next";
import React, {useState, useEffect} from "react";

import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import {Chip, Select, InputLabel, FormControl} from "@mui/material";

import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";

import type { ClientListItemDto} from "../../../api/Client";

type ClientSelectProps = {
    selectedClientId: string | null,
    shouldValidate: boolean,
    disabled?: boolean,
    onSelect: (clientId: string) => void,
}

export function ClientSelect({selectedClientId, shouldValidate, disabled, onSelect}: Readonly<ClientSelectProps>) {
    const {t} = useTranslation();
    const { showSnackbar } = useSnackbar();

    const [clients, setClients] = useState<ClientListItemDto[]>([]);

    useEffect(() => {
        void fetchClients();
    }, [])

    const fetchClients = async () => {
        try {
            const client = new AuthorizedClient();
            await client.fetchClients({}).then(loadedClients => setClients(loadedClients));
        }
        catch(e){
            showSnackbar('clients.loadListError', 'error');
            console.error('Error fetching clients', e);
        }
    }

    return (
        <FormControl fullWidth>
            <InputLabel id="clients-select-label" error={shouldValidate && (selectedClientId === null || selectedClientId === "")}>{t('orders.clientSelectLabel')}</InputLabel>
            <Select
                disabled={disabled}
                error={shouldValidate && (selectedClientId === null || selectedClientId === "")}
                labelId="clients-state-select-id"
                value={selectedClientId}
                renderValue={(selected) => {
                    const client = clients.find(c => c.id === selected);
                    return client ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            <Chip key={client.id} label={client.name} size="small" />
                        </Box>
                    ) : null;
                }}
            >
                {clients.map((client) => (
                    <MenuItem
                        key={client.id}
                        value={client.id}
                        onClick={() => {
                            onSelect(client.id!)
                        }}>
                        <Checkbox checked={selectedClientId === client.id} />
                        <ListItemText primary={client.name} />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}