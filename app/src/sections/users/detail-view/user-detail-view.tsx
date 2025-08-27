import {useState, useCallback} from "react";
import {useTranslation} from "react-i18next";

import {Typography} from "@mui/material";

import {UpdateUserView} from "./update-user-view";
import {CreateUserView} from "./create-user-view";
import {
    UpdateUserDto
} from "../../../api/Client";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {DetailCardLayout} from "../../../layouts/dashboard/detail-card-layout";

import type {
    UserListItemDto
} from "../../../api/Client";

type UserDetailViewProps = {
    user: UserListItemDto | undefined;
    shouldCheckPendingChanges: boolean;
    onDelete: () => void;
    onHasChangesChange?: (hasChanges: boolean) => void;
    onProgressbarVisibilityChange: (isVisible: boolean) => void;
};

export function UserDetailView(
    {
        user, 
        shouldCheckPendingChanges,
        onDelete,
        onHasChangesChange,
        onProgressbarVisibilityChange
}: Readonly<UserDetailViewProps>) {
    const {t} = useTranslation();
    const {showSnackbar} = useSnackbar();

    const [initialUser, setInitialUser] = useState<UpdateUserDto | null>(null);
    const [userDetail, setUserDetail] = useState<UpdateUserDto | null>(null);
    const [shouldValidate, setShouldValidate] = useState<boolean>(false);

    const saveUser = useCallback(async () => {
        setShouldValidate(true);
        return await updateUser(user!.id!, userDetail!);
    }, [userDetail, user]);

    const updateUser = async (userId: string, userToUpdate: UpdateUserDto) => {
        try {
            if (userToUpdate.userRoles.length === 0) {
                setShouldValidate(true);
                showSnackbar(t('common.validationError'), 'error');
                return false;
            }
            setShouldValidate(false);

            const client = new AuthorizedClient();
            return await client.updateUserEndpoint(userId, userToUpdate).then(() => {
                showSnackbar(t('users.saveSuccess'), 'success');
                setInitialUser(userToUpdate);
                return true;
            });

        } catch (error) {
            showSnackbar(t('users.saveError'), 'error');
            console.error('Error saving user:', error);
            return false;
        }
    }

    const fetchUser = useCallback(async () => {
        if (user === null || user === undefined) {
            return;
        }
        
        const detail = new UpdateUserDto({
            firstName: user.firstName,
            lastName: user.lastName,
            userRoles: user.userRoles ?? [],
        });

        setInitialUser(detail);
        setUserDetail(detail);
        onProgressbarVisibilityChange(false);

    }, [user, onProgressbarVisibilityChange, showSnackbar, t]);

    const deleteUser = useCallback(async () => {
        if (user === null || user === undefined) {
            return;
        }
        const client = new AuthorizedClient();
        await client.deleteUserEndpoint(user.id!);
        showSnackbar(t('users.userDeleted'), 'success');
    }, [user, showSnackbar]);

    const resetUser = useCallback(() => {
        setUserDetail(initialUser);
    }, [initialUser]);
    
    return (
        <>
            {user === undefined && <Typography sx={{mt: 2, ml: 2}}>
                {t('users.noDetailToDisplay')}
            </Typography>
            }
            {user !== undefined && user !== null && <DetailCardLayout
                id={user.id!}
                shouldCheckPendingChanges={shouldCheckPendingChanges}
                onDelete={onDelete}
                onConfirmed={() => {}}
                onHasChangesChange={onHasChangesChange}
                onProgressbarVisibilityChange={onProgressbarVisibilityChange}
                title={`${t('users.detailTitle')} - ${user.userName}`}
                noDetailMessage={t('users.noDetailToDisplay')}
                entity={userDetail}
                initialEntity={initialUser}
                onFetchEntity={fetchUser}
                onSaveEntity={saveUser}
                onDeleteEntity={deleteUser}
                onResetEntity={resetUser}
                deleteConfirmMessage={t('users.deleteConfirm')}
                resetConfirmMessage={t('common.resetConfirm')}
                pendingChangesConfirmMessage={t('common.pendingChangesConfirm')}
            >
                {userDetail != null && <UpdateUserView
                    user={userDetail}
                    shouldValidate={shouldValidate}
                    onChange={setUserDetail}
                />}
            </DetailCardLayout>}
        </>
    )
}