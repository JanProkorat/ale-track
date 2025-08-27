import {useTranslation} from "react-i18next";
import React, {useState, useEffect} from "react";

import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import {Button, Dialog, DialogTitle, DialogActions } from "@mui/material";

import {UsersTableRow} from "../users-table-row";
import {emptyRows} from "../../../providers/utils";
import {Scrollbar} from "../../../components/scrollbar";
import {UsersTableToolbar} from "../users-table-toolbar";
import {useTable} from "../../../providers/TableProvider";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {UserDetailView} from "../detail-view/user-detail-view";
import {CreateUserView} from "../detail-view/create-user-view";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {TableNoData} from "../../../components/table/table-no-data";
import {TableEmptyRows} from "../../../components/table/table-empty-rows";
import {SplitViewLayout} from "../../../layouts/dashboard/split-view-layout";
import {SortableTableHead} from "../../../components/table/sortable-table-head";

import type { UserListItemDto} from "../../../api/Client";

export function UsersView() {
    const {t} = useTranslation();
    const { showSnackbar } = useSnackbar();

    const [initialLoading, setInitialLoading] = useState<boolean>(false);
    const [users, setUsers] = useState<UserListItemDto[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserListItemDto | undefined>(undefined);
    const [pendingUser, setPendingUser] = useState<UserListItemDto | null>(null);
    const [pendingUserForConfirmation, setPendingUserForConfirmation] = useState<UserListItemDto | null | undefined>(undefined);
    const [hasDetailChanges, setHasDetailChanges] = useState<boolean>(false);
    const [createUserDrawerVisible, setCreateUserDrawerVisible] = useState<boolean>(false);

    const [filterUserName, setFilterUserName] = useState<string | null>(null);

    const [order, setOrder] = useState<'asc' | 'desc'>('asc');
    const [orderBy, setOrderBy] = useState<string>('userName');

    const table = useTable({order, setOrder, orderBy, setOrderBy});

    useEffect(() => {
        setInitialLoading(true);
        const loadInitial = async () => {
            const loaded = await fetchUsers();
            setUsers(loaded);
            setSelectedUser(loaded.length > 0 ? loaded[0] : undefined);
            setInitialLoading(false);
        };
        void loadInitial();
    }, []);

    useEffect(() => {
        if (!initialLoading) {
            void fetchUsers().then(setUsers);
        }
    }, [filterUserName, order, orderBy]);

    const fetchUsers = async () => {
        try {
            const client = new AuthorizedClient();
            const filters: Record<string, string> = {};

            if (filterUserName !== null) {
                filters.userName = `startsWith:${filterUserName}`;
            }

            filters.sort = `${order}:${orderBy}`;

            return await client.fetchUsers(filters);
        } catch (error) {
            showSnackbar(t('users.loadListError'), 'error');
            console.error('Error fetching users:', error);
            return [];
        }
    };

    const handleRowClick = (user: UserListItemDto) => {
        if (selectedUser?.id === user.id)
            return;

        updateSelectedUser(user)
    };

    const updateSelectedUser = (user: UserListItemDto) => {
        if (hasDetailChanges) {
            setPendingUser(user);
        } else {
            setSelectedUser(user);
        }
    }

    const handleNewUserClick = () => {
        if (selectedUser !== undefined && selectedUser !== null && hasDetailChanges) {
            setPendingUserForConfirmation(null);
        } else {
            setCreateUserDrawerVisible(true)
        }
    }

    const handleDeleteUser = async () => {
        await fetchUsers().then((newData) => {
            setUsers(newData);
            setSelectedUser(newData.length > 0 ? newData[0]: undefined);
        })
    }

    const handleUserCreated = async (newUserId: string) => {
        await fetchUsers().then((data) => {
            setUsers(data)
            setSelectedUser(data.find(u => u.id === newUserId))
            setCreateUserDrawerVisible(false);
        });
    }

    const closeDrawer = () => {
        fetchUsers().then(setUsers);
        setCreateUserDrawerVisible(false);
    }

    const userListCard = (
        <>
            <UsersTableToolbar
                numSelected={table.selected.length}
                filterUserName={filterUserName}
                onFilterUserName={(value: string | null) => {
                    setFilterUserName(value ?? null);
                    table.onResetPage();
                }}
            />

            <Scrollbar>
                <TableContainer sx={{overflow: 'unset'}}>
                    <Table>
                        <SortableTableHead
                            order={table.order}
                            orderBy={table.orderBy}
                            rowCount={users.length}
                            numSelected={table.selected.length}
                            onSort={table.onSort}
                            onSelectAllRows={(checked) =>
                                table.onSelectAllRows(
                                    checked,
                                    users.map((user) => user.id!)
                                )
                            }
                            headLabel={[
                                {id: 'userName', label: t('users.userName')}
                            ]}
                        />
                        <TableBody>
                            {users
                                .slice(
                                    table.page * table.rowsPerPage,
                                    table.page * table.rowsPerPage + table.rowsPerPage
                                )
                                .map((row) => (
                                    <UsersTableRow
                                        key={row.id}
                                        row={row}
                                        selected={table.selected.includes(row.id!)}
                                        onSelectRow={() => table.onSelectRow(row.id!)}
                                        onRowClick={() => handleRowClick(row)}
                                        isSelected={selectedUser?.id === row.id}
                                    />
                                ))}

                            <TableEmptyRows
                                height={68}
                                emptyRows={emptyRows(table.page, table.rowsPerPage, users.length)}
                            />

                            {users.length == 0 && <TableNoData colSpan={1} />}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Scrollbar>
        </>
    );

    return (
        <>
            <SplitViewLayout
                title={t('users.title')}
                initialLoading={initialLoading}
                newLabel={t('users.new')}
                onNewClick={handleNewUserClick}
                leftContentWidth={30}
                minHeight={350}
                leftContent={userListCard}
                rightContent={<UserDetailView
                    user={selectedUser}
                    shouldCheckPendingChanges={pendingUser !== null}
                    onDelete={handleDeleteUser}
                    onProgressbarVisibilityChange={setInitialLoading}
                />}
                drawerContent={<CreateUserView
                    onClose={closeDrawer}
                    onSave={handleUserCreated}
                />}
                onDrawerClose={closeDrawer}
                drawerOpen={createUserDrawerVisible}
            />

            <Dialog
                open={pendingUserForConfirmation !== undefined}
                onClose={() => setPendingUserForConfirmation(undefined)}
            >
                <DialogTitle>
                    {t('common.unsavedChangesLossConfirm')}
                </DialogTitle>
                <DialogActions>
                    <Button onClick={() => setPendingUserForConfirmation(undefined)} variant="contained" color="primary">
                        {t('common.cancel')}
                    </Button>
                    <Button
                        color="inherit"
                        onClick={() => {
                            setHasDetailChanges(false);

                            if (pendingUserForConfirmation === null) {
                                setSelectedUser(undefined);
                            } else {
                                updateSelectedUser(pendingUserForConfirmation!);
                            }

                            setPendingUserForConfirmation(undefined);
                        }}
                    >
                        {t('common.continue')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );}
