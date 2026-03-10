import type { Column } from 'src/components/common/DataTable';
import type { DriverListItemDto } from 'src/generated/api-client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';

import DataTable from 'src/components/common/DataTable';

// ---------------------------------------------------------------------------

interface DriverNameListProps {
     drivers: DriverListItemDto[];
     loading: boolean;
     search: string;
     onSearchChange: (value: string) => void;
     selectedId: string | null;
     onSelect: (id: string) => void;
     sortAsc: boolean;
     onToggleSort: () => void;
}

export default function DriverNameList({
     drivers,
     loading,
     search,
     onSearchChange,
     selectedId,
     onSelect,
     sortAsc,
     onToggleSort,
}: DriverNameListProps) {
     const { t } = useTranslation();

     const sortedDrivers = useMemo(() => {
          const sorted = [...drivers].sort((a, b) => {
               const nameA = `${a.lastName ?? ''} ${a.firstName ?? ''}`.trim();
               const nameB = `${b.lastName ?? ''} ${b.firstName ?? ''}`.trim();
               return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
          });
          return sortAsc ? sorted : sorted.reverse();
     }, [drivers, sortAsc]);

     const columns: Column<DriverListItemDto>[] = useMemo(
          () => [
               {
                    id: 'name',
                    label: `${t('drivers.lastName')}`,
                    render: (row) => (
                         <Box
                              sx={{
                                   display: 'flex',
                                   alignItems: 'center',
                                   gap: 1,
                                   whiteSpace: 'nowrap',
                                   overflow: 'hidden',
                                   textOverflow: 'ellipsis',
                                   maxWidth: 160,
                              }}
                         >
                              <Box
                                   sx={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        bgcolor: row.color ?? '#ccc',
                                        flexShrink: 0,
                                   }}
                              />
                              {`${row.firstName ?? ''} ${row.lastName ?? ''}`.trim()}
                         </Box>
                    ),
               },
          ],
          [t],
     );

     return (
          <Card sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 1 }}>
               <DataTable
                    columns={columns}
                    rows={sortedDrivers}
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
