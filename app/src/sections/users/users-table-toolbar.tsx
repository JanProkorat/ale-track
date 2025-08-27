import React from "react";
import {useTranslation} from "react-i18next";

import OutlinedInput from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";

import {Iconify} from "../../components/iconify";
import {TableToolbar} from "../../components/table/table-toolbar";

type UsersToolbarProps = {
    numSelected: number;
    filterUserName: string | null;
    onFilterUserName: (newName: string | null) => void;
};

export function UsersTableToolbar(
    {
        numSelected,
        filterUserName,
        onFilterUserName,
    }: Readonly<UsersToolbarProps>) {
    const { t } = useTranslation();
    const filters = [
        <OutlinedInput
            key="user"
            fullWidth
            value={filterUserName}
            onChange={(event) => onFilterUserName(event.target.value)}
            placeholder={t('users.userName') + '...'}
            startAdornment={
                <InputAdornment position="start">
                    <Iconify width={20} icon="eva:search-fill" sx={{color: 'text.disabled'}}/>
                </InputAdornment>
            }
        />
    ];

    return <TableToolbar numSelected={numSelected} filters={filters}/>;
}
