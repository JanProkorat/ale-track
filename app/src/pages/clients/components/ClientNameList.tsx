import type { ClientListItemDto } from 'src/generated/api-client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';

import DataTable from 'src/components/common/DataTable';

import type { Column } from 'src/components/common/DataTable';

// ---------------------------------------------------------------------------

interface ClientNameListProps {
     clients: ClientListItemDto[];
     loading: boolean;
     search: string;
     onSearchChange: (value: string) => void;
     selectedId: string | null;
     onSelect: (id: string) => void;
     sortAsc: boolean;
     onToggleSort: () => void;
}

export default function ClientNameList({
     clients,
     loading,
     search,
     onSearchChange,
     selectedId,
     onSelect,
     sortAsc,
     onToggleSort,
}: ClientNameListProps) {
     const { t } = useTranslation();

     const sortedClients = useMemo(() => {
          const sorted = [...clients].sort((a, b) =>
               (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }),
          );
          return sortAsc ? sorted : sorted.reverse();
     }, [clients, sortAsc]);

     const columns: Column<ClientListItemDto>[] = useMemo(
          () => [
               {
                    id: 'name',
                    label: t('clients.name'),
                    render: (row) => (
                         <Box
                              sx={{
                                   whiteSpace: 'nowrap',
                                   overflow: 'hidden',
                                   textOverflow: 'ellipsis',
                                   maxWidth: 160,
                              }}
                         >
                              {row.name}
                         </Box>
                    ),
               },
          ],
          [t],
     );

     return (
          <Card sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', p:1 }}>
               <DataTable
                    columns={columns}
                    rows={sortedClients}
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
