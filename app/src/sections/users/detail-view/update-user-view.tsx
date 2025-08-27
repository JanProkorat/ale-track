
import {useState, useEffect} from "react";
import {useTranslation} from "react-i18next";

import TextField from "@mui/material/TextField";
import FormControlLabel from "@mui/material/FormControlLabel";
import {Box, Checkbox, FormGroup, FormLabel, FormControl} from "@mui/material";

import {UserRoleType, UpdateUserDto} from "../../../api/Client";


type UserDetailViewProps = {
    user: UpdateUserDto;
    shouldValidate: boolean;
    onChange: (user: UpdateUserDto) => void;
};

export function UpdateUserView({user, shouldValidate, onChange}: Readonly<UserDetailViewProps>) {
    const {t} = useTranslation();

    const [detail, setDetail] = useState<UpdateUserDto>(user);

    useEffect(() => {
        setDetail(new UpdateUserDto({
            ...user,
            userRoles: user.userRoles ?? [],
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? ""
        }));
    }, [user]);

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                pl: 2,
                pr: 2
            }}
        >
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mt: 1}}>
                <FormControl fullWidth>
                    <TextField
                        variant="outlined"
                        value={detail.firstName ?? ""}
                        label={t('users.firstName')}
                        onChange={(event) => {
                            onChange(new UpdateUserDto({
                                ...detail,
                                firstName: event.target.value
                            }))
                        }}
                    />
                </FormControl>
                <FormControl fullWidth>
                    <TextField
                        variant="outlined"
                        value={detail.lastName ?? ""}
                        label={t('users.lastName')}
                        onChange={(event) => {
                            onChange(new UpdateUserDto({
                                ...detail,
                                lastName: event.target.value
                            }))
                        }}
                    />
                </FormControl>
            </Box>
            <FormControl
                required
                error={shouldValidate && detail.userRoles.length === 0}
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
                                        checked={detail.userRoles.includes(role)}
                                        onChange={(event) => {
                                            const checked = event.target.checked;
                                            const updatedRoles = checked
                                                ? [...detail.userRoles, role]
                                                : detail.userRoles.filter(r => r !== role);
                                            onChange(new UpdateUserDto({
                                                ...detail,
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
        </Box>
    );
}