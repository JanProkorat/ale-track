import {useState, useCallback} from "react";
import {useTranslation} from "react-i18next";

import {Typography} from "@mui/material";

import {useAuthorizedClient} from "src/api/use-authorized-client";

import {UpdateUserView} from "./update-user-view";
import {useApiCall} from "../../../hooks/use-api-call";
import {
    UpdateUserDto
} from "../../../api/Client";
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
    const { executeApiCall } = useApiCall();
    const client = useAuthorizedClient();

    const [initialUser, setInitialUser] = useState<UpdateUserDto | null>(null);
    const [userDetail, setUserDetail] = useState<UpdateUserDto | null>(null);
    const [shouldValidate, setShouldValidate] = useState<boolean>(false);

    const updateUser = useCallback(async (userId: string, userToUpdate: UpdateUserDto) => {
        if (userToUpdate.userRoles.length === 0) {
            setShouldValidate(true);
            showSnackbar(t('common.validationError'), 'error');
            return false;
        }
        setShouldValidate(false);

        let hasError = false;
        await executeApiCall(
            () => client.updateUserEndpoint(userId, userToUpdate),
            undefined,
            { onError: () => { hasError = true; } }
        );

        if (hasError) {
            return false;
        }

        showSnackbar(t('users.saveSuccess'), 'success');
        setInitialUser(userToUpdate);
        return true;
    }, [client, executeApiCall, showSnackbar, t]);

    const saveUser = useCallback(async () => {
        setShouldValidate(true);
        return await updateUser(user!.id!, userDetail!);
    }, [userDetail, user, updateUser]);

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

    }, [user, onProgressbarVisibilityChange]);

    const deleteUser = useCallback(async () => {
        if (user === null || user === undefined) {
            return;
        }
        const success = await executeApiCall(() => client.deleteUserEndpoint(user.id!));
        
        if (success) {
            showSnackbar(t('users.userDeleted'), 'success');
        }
    }, [client, user, executeApiCall, showSnackbar, t]);

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