import type { UserListItemDto } from 'src/generated/api-client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';

import { useEnumLabel } from 'src/utils/enumTranslations';

import DataTable from 'src/components/common/DataTable';

import type { Column } from 'src/components/common/DataTable';

// ---------------------------------------------------------------------------

interface UserNameListProps {
     users: UserListItemDto[];
     loading: boolean;
     search: string;
     onSearchChange: (value: string) => void;
     selectedId: string | null;
     onSelect: (id: string) => void;
     sortAsc: boolean;
     onToggleSort: () => void;
}

export default function UserNameList({
     users,
     loading,
     search,
     onSearchChange,
     selectedId,
     onSelect,
     sortAsc,
     onToggleSort,
}: UserNameListProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();

     const sortedUsers = useMemo(() => {
          const sorted = [...users].sort((a, b) => {
               const nameA = a.userName ?? '';
               const nameB = b.userName ?? '';
               return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
          });
          return sortAsc ? sorted : sorted.reverse();
     }, [users, sortAsc]);

     const columns: Column<UserListItemDto>[] = useMemo(
          () => [
               {
                    id: 'userName',
                    label: t('users.userName'),
                    render: (row) => (
                         <Box
                              sx={{
                                   display: 'flex',
                                   alignItems: 'center',
                                   gap: 1,
                                   whiteSpace: 'nowrap',
                                   overflow: 'hidden',
                                   textOverflow: 'ellipsis',
                                   maxWidth: 200,
                              }}
                         >
                              <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                   {row.userName ?? ''}
                              </Box>
                              {(row.userRoles ?? []).map((role) => (
                                   <Chip
                                        key={role}
                                        label={enumLabel.userRole(role)}
                                        size="small"
                                        variant="outlined"
                                        sx={{ height: 20, fontSize: '0.7rem' }}
                                   />
                              ))}
                         </Box>
                    ),
               },
          ],
          [t, enumLabel],
     );

     return (
          <Card sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 1 }}>
               <DataTable
                    columns={columns}
                    rows={sortedUsers}
                    getId={(row) => row.id ?? ''}
                    loading={loading}
                    searchValue={search}
                    onSearchChange={onSearchChange}
                    selectedId={selectedId}
                    onRowClick={(row) => row.id && onSelect(row.id)}
               />
          </Card>
     );
}
