import React, { useState} from "react";
import {useTranslation} from "react-i18next";

import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import FormControlLabel from "@mui/material/FormControlLabel";
import {Checkbox, FormGroup, FormLabel, IconButton, Typography, FormControl} from "@mui/material";

import {Iconify} from "../../../components/iconify";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {
    UserRoleType, CreateUserDto
} from "../../../api/Client";
import {DrawerLayout} from "../../../layouts/components/drawer-layout";

type CreateUserViewProps = {
    onClose: () => void
    onSave: (newUserId: string) => void
};

export function CreateUserView({onClose, onSave}: Readonly<CreateUserViewProps>) {
    const {t} = useTranslation();
    const {showSnackbar} = useSnackbar();
    
    const [user, setUser] = useState<CreateUserDto>(new CreateUserDto({
        userName: "",
        password: "",
        userRoles: []
    }));

    const [shouldValidate, setShouldValidate] = useState<boolean>(false);
    const [userNameTouched, setUserNameTouched] = useState<boolean>(false);
    const [passwordTouched, setPasswordTouched] = useState<boolean>(false);

    const handleSave = async () => {
        try {
            if (
                !user.userName ||
                user.userName === "" ||
                !user.password ||
                user.password === "" ||
                user.userRoles.length === 0
            ) {
                setShouldValidate(true);
                showSnackbar(t('common.validationError'), 'error');
                return;
            }
            setShouldValidate(false);

            const client = new AuthorizedClient();
            await client.createUserEndpoint(user).then(onSave)
        } catch (error) {
            showSnackbar(t('users.saveError'), 'error');
            console.error('Error creating new product delivery:', error);
        }
    }

    return (
        <DrawerLayout
            title={t('users.new')}
            isLoading={false}
            onClose={onClose}
            onSaveAndClose={handleSave}
        >
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <TextField
                    fullWidth
                    variant="outlined"
                    value={user.userName ?? ""}
                    label={t('users.userName')}
                    error={shouldValidate && userNameTouched && user.userName === ""}
                    onChange={(event) => {
                        if (!userNameTouched)
                            setUserNameTouched(true);

                        setUser(new CreateUserDto({
                            ...user,
                            userName: event.target.value
                        }))
                    }}
                />
                <TextField
                    fullWidth
                    variant="outlined"
                    type="password"
                    value={user.password ?? ""}
                    label={t('common.password')}
                    error={shouldValidate && passwordTouched && user.password === ""}
                    onChange={(event) => {
                        if (!passwordTouched)
                            setPasswordTouched(true);

                        setUser(new CreateUserDto({
                            ...user,
                            password: event.target.value
                        }))
                    }}
                />
            </Box>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <TextField
                    fullWidth
                    variant="outlined"
                    value={user.firstName}
                    label={t('users.firstName')}
                    onChange={(event) => {
                        setUser(new CreateUserDto({
                            ...user,
                            firstName: event.target.value
                        }))
                    }}
                />
                <TextField
                    fullWidth
                    variant="outlined"
                    value={user.lastName}
                    label={t('users.lastName')}
                    onChange={(event) => {
                        setUser(new CreateUserDto({
                            ...user,
                            lastName: event.target.value
                        }))
                    }}
                />
            </Box>
            <FormControl
                required
                error={shouldValidate && user.userRoles.length === 0}
                component="fieldset"
                sx={{
                    border: '1px solid',
                    borderColor: (theme) => theme.palette.grey[300],
                    borderRadius: 1,
                    p: 2,
                    mt: 1
                }}
            >
                <FormLabel component="legend">{t('users.userRoles')}</FormLabel>
                <FormGroup>
                    {Object.keys(UserRoleType).filter(key => isNaN(Number(key))).map(type => {
                        const role = type as unknown as UserRoleType;
                        return (
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={user.userRoles.includes(role)}
                                        onChange={(event) => {
                                            const checked = event.target.checked;
                                            const updatedRoles = checked
                                                ? [...user.userRoles, role]
                                                : user.userRoles.filter(r => r !== role);
                                            setUser(new CreateUserDto({
                                                ...user,
                                                userRoles: updatedRoles,
                                            }));
                                        }}
                                        name={t('UserRoleType.' + role.toString())}
                                    />
                                }
                                label={t('UserRoleType.' + type)}
                            />
                        )
                    })}
                </FormGroup>
            </FormControl>
        </DrawerLayout>
    )
}