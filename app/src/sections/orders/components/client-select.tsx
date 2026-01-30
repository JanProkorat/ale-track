import {useTranslation} from "react-i18next";
import React, {useState, useEffect, useCallback} from "react";

import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import {Chip, Select, InputLabel, FormControl} from "@mui/material";

import {useApiCall} from "../../../hooks/use-api-call";
import {AuthorizedClient} from "../../../api/AuthorizedClient";

import type { ClientListItemDto} from "../../../api/Client";

type ClientSelectProps = {
    selectedClientId: string | null,
    shouldValidate: boolean,
    disabled?: boolean,
    onSelect: (clientId: string) => void,
}

export function ClientSelect({selectedClientId, shouldValidate, disabled, onSelect}: Readonly<ClientSelectProps>) {
    const {t} = useTranslation();
    const {executeApiCallWithDefault} = useApiCall();

    const [clients, setClients] = useState<ClientListItemDto[]>([]);

    const fetchClients = useCallback(async () => {
        const client = new AuthorizedClient();
        const loadedClients = await executeApiCallWithDefault(() => client.fetchClients({}), []);
        setClients(loadedClients);
    }, [executeApiCallWithDefault]);

    useEffect(() => {
        void fetchClients();
    }, [fetchClients])

    return (
        <FormControl fullWidth>
            <InputLabel id="clients-select-label" error={shouldValidate && (selectedClientId === null || selectedClientId === "")}>{t('orders.clientSelectLabel')}</InputLabel>
            <Select
                key="clients-select-key"
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