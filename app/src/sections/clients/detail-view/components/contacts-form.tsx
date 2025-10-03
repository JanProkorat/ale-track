import React from "react";
import {useTranslation} from "react-i18next";

import Box from "@mui/material/Box";
import List from "@mui/material/List";
import {Typography} from "@mui/material";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import ListItem from "@mui/material/ListItem";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import EmailIcon from '@mui/icons-material/Email';
import FormControl from "@mui/material/FormControl";
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';

import {ContactType} from "../../../../api/Client";
import {Iconify} from "../../../../components/iconify";
import {mapEnumValue} from "../../../../utils/format-enum-value";
import {CollapsibleForm} from "../../../../components/forms/collapsible-form";

import type {CreateClientContactDto, UpdateClientContactDto} from "../../../../api/Client";

type AllowedItem = CreateClientContactDto | UpdateClientContactDto;

type ContactsFormProps<T extends AllowedItem> = {
    selectedContacts: T[];
    onContactsChanged: (contacts: {type: ContactType, description: string | undefined, value: string}[]) => void;
    validationErrors?: { [contactIndex: number]: { type?: boolean; value?: boolean } };
}

export function ContactsForm<T extends AllowedItem & { _key?: string }>({ selectedContacts, onContactsChanged, validationErrors }: Readonly<ContactsFormProps<T>>) {
    const {t} = useTranslation();

    const handleContactChange = (index: number, field: keyof T, value: any) => {
        const updatedContacts = selectedContacts.map((contact, i) =>
            i === index ? { ...contact, [field]: value } : contact
        );
        onContactsChanged(updatedContacts as any);
    };

    const handleRemoveContact = (index: number) => {
        const updatedContacts = selectedContacts.filter((_, i) => i !== index);
        onContactsChanged(updatedContacts as any);
    };

    const handleAddContact = () => {
        const newContact = {
            type: ContactType.Email,
            description: '',
            value: ''
        } as T;
        const updatedContacts = [...selectedContacts, newContact];
        onContactsChanged(updatedContacts as any);
    };

    const getContactTypeLabel = (type?: ContactType) => {
        switch (type) {
            case 0: // ContactType.Email
                return t('clients.contacts.types.email');
            case 1: // ContactType.Phone
                return t('clients.contacts.types.phone');
            default:
                return '';
        }
    };

    const getPlaceholderText = (type?: ContactType) => {
        switch (type) {
            case 0: // ContactType.Email
                return 'example@email.com';
            case 1: // ContactType.Phone
                return '+420 123 456 789';
            default:
                return '';
        }
    };

    const newButton = (visible: boolean) => (
        <Box sx={{display: 'flex', alignItems: 'center'}}>
            <Button
                variant="contained"
                color="inherit"
                startIcon={<Iconify icon="mingcute:add-line"/>}
                size="small"
                sx={{
                    visibility: visible ? 'visible' : 'hidden',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    mb: 1,
                    mt: 1,
                }}
                onClick={handleAddContact}
            >
                {t('clients.contacts.new')}
            </Button>
        </Box>
    );

    const noDataBox = (
        <Box sx={{py: 5, textAlign: 'center', width: '100%'}}>
            <Typography variant="h6" sx={{mb: 1}}>
                {t('clients.contacts.noDataTitle')}
            </Typography>

            <Typography variant="body2" whiteSpace="pre-line">
                {t('clients.contacts.noDataMessage')}
            </Typography>
            <Box sx={{mt: 2, display: 'flex', justifyContent: 'center'}}>
                {newButton(selectedContacts.length === 0)}
            </Box>
        </Box>
    );

    const contactsList = (
        <List>
            {selectedContacts.map((contact, index) => (
                <ListItem
                    key={contact._key || `contact-${index}`}
                    sx={{
                        display: 'flex',
                        gap: 2,
                        alignItems: 'flex-start',
                        flexWrap: { xs: 'wrap', sm: 'nowrap' },
                        py: 2
                    }}
                >
                    <Box sx={{mt: 1}}>
                        {contact.type === ContactType.Phone ? <PhoneInTalkIcon /> : <EmailIcon /> }
                    </Box>

                    <FormControl size="small" sx={{ minWidth: 120 }} error={!!validationErrors?.[index]?.type}>
                        <InputLabel>{t('clients.contacts.type')}</InputLabel>
                        <Select
                            value={mapEnumValue(ContactType, contact.type)}
                            label={t('clients.contacts.type')}
                            onChange={(e) => handleContactChange(index, 'type' as keyof T, e.target.value)}
                        >
                            <MenuItem value={0}>{getContactTypeLabel(0)}</MenuItem>
                            <MenuItem value={1}>{getContactTypeLabel(1)}</MenuItem>
                        </Select>
                        {validationErrors?.[index]?.type && (
                            <Typography variant="caption" color="error" sx={{ mt: 0.5, fontSize: '0.75rem' }}>
                                {t('common.required')}
                            </Typography>
                        )}
                    </FormControl>

                    <TextField
                        id={`contact-description-${index}`}
                        size="small"
                        label={t('clients.contacts.description')}
                        value={contact.description ?? ''}
                        onChange={(e) => handleContactChange(index, 'description' as keyof T, e.target.value)}
                        sx={{ flexGrow: 1, minWidth: 150 }}
                    />

                    <TextField
                        id={`contact-value-${index}`}
                        size="small"
                        label={contact.type === 0 ? t('clients.contacts.email') : t('clients.contacts.phone')}
                        value={contact.value ?? ''}
                        onChange={(e) => handleContactChange(index, 'value' as keyof T, e.target.value)}
                        placeholder={getPlaceholderText(contact.type)}
                        sx={{ flexGrow: 1, minWidth: 200 }}
                        error={!!validationErrors?.[index]?.value}
                    />

                    <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveContact(index)}
                        sx={{ mt: 0.5 }}
                    >
                        <Iconify icon="solar:trash-bin-trash-bold" />
                    </IconButton>
                </ListItem>
            ))}
        </List>
    );
    
    return (
        <CollapsibleForm title={t('clients.contacts.title')} titleVariant="subtitle1" headerChildren={newButton(selectedContacts.length > 0)}>
            {selectedContacts.length === 0 ? noDataBox : contactsList}
        </CollapsibleForm>
    );
}