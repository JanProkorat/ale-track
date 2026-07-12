import type { VehicleListItemDto } from 'src/generated/api-client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import AddIcon from '@mui/icons-material/Add';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import SaveIcon from '@mui/icons-material/Save';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { useVehicles, useUpdateVehicle, useDeleteVehicle } from 'src/hooks/useVehicles';

import { UpdateVehicleDto } from 'src/generated/api-client';

import PageHeader from 'src/components/common/PageHeader';
import ConfirmDialog from 'src/components/common/ConfirmDialog';

import CreateVehicleDrawer from './components/CreateVehicleDrawer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditedRow {
     name?: string;
     maxWeight?: string;
}

interface EditedRows {
     [vehicleId: string]: EditedRow;
}

// ---------------------------------------------------------------------------
// VehicleListPage
// ---------------------------------------------------------------------------

export default function VehicleListPage() {
     const { t } = useTranslation();
     const [search, setSearch] = useState('');

     const { data: vehicles = [], isLoading } = useVehicles(search);
     const updateMutation = useUpdateVehicle();
     const deleteMutation = useDeleteVehicle();

     const [editedRows, setEditedRows] = useState<EditedRows>({});
     const [deleteTarget, setDeleteTarget] = useState<VehicleListItemDto | null>(null);
     const [createOpen, setCreateOpen] = useState(false);

     const handleFieldChange = useCallback(
          (id: string, field: keyof EditedRow, value: string) => {
               setEditedRows((prev) => ({
                    ...prev,
                    [id]: { ...prev[id], [field]: value },
               }));
          },
          [],
     );

     const handleReset = useCallback((id: string) => {
          setEditedRows((prev) => {
               const next = { ...prev };
               delete next[id];
               return next;
          });
     }, []);

     const handleSave = useCallback(
          (vehicle: VehicleListItemDto) => {
               if (!vehicle.id) return;
               const edited = editedRows[vehicle.id];
               if (!edited) return;

               const name = edited.name ?? vehicle.name ?? '';
               const weight = edited.maxWeight ?? (vehicle.maxWeight != null ? String(vehicle.maxWeight) : '');

               const dto = new UpdateVehicleDto();
               dto.name = name;
               dto.maxWeight = weight === '' ? undefined : Number(weight);

               updateMutation.mutate(
                    { id: vehicle.id, data: dto },
                    {
                         onSuccess: () => handleReset(vehicle.id!),
                    },
               );
          },
          [editedRows, updateMutation, handleReset],
     );

     const handleDeleteConfirm = () => {
          if (!deleteTarget?.id) return;
          deleteMutation.mutate(deleteTarget.id, {
               onSuccess: () => setDeleteTarget(null),
          });
     };

     const isDirty = (id: string) => !!editedRows[id];

     return (
          <Box>
               <PageHeader
                    title={t('vehicles.title')}
                    action={
                         <Button
                              variant="contained"
                              color="inherit"
                              startIcon={<AddIcon />}
                              onClick={() => setCreateOpen(true)}
                         >
                              {t('vehicles.addVehicle')}
                         </Button>
                    }
               />

               <Card>
                    <Box sx={{ p: 2 }}>
                         <TextField
                              size="small"
                              placeholder={t('common.search')}
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              sx={{ width: 260 }}
                         />
                    </Box>

                    <TableContainer>
                         <Table size="small">
                              <TableHead>
                                   <TableRow>
                                        <TableCell>{t('vehicles.name')}</TableCell>
                                        <TableCell sx={{ width: 200 }}>
                                             {t('vehicles.maxWeight')}
                                        </TableCell>
                                        <TableCell align="right" sx={{ width: 140 }}>
                                             {t('common.actions')}
                                        </TableCell>
                                   </TableRow>
                              </TableHead>
                              <TableBody>
                                   {isLoading && (
                                        <TableRow>
                                             <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                                                  <CircularProgress size={28} />
                                             </TableCell>
                                        </TableRow>
                                   )}
                                   {!isLoading && vehicles.length === 0 && (
                                        <TableRow>
                                             <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                                  {t('common.noData')}
                                             </TableCell>
                                        </TableRow>
                                   )}
                                   {vehicles.map((vehicle) => {
                                        const id = vehicle.id ?? '';
                                        const edited = editedRows[id];
                                        const currentName = edited?.name ?? vehicle.name ?? '';
                                        const currentWeight =
                                             edited?.maxWeight ?? (vehicle.maxWeight != null ? String(vehicle.maxWeight) : '');
                                        const dirty = isDirty(id);

                                        return (
                                             <TableRow key={id} hover>
                                                  <TableCell>
                                                       <TextField
                                                            size="small"
                                                            value={currentName}
                                                            onChange={(e) =>
                                                                 handleFieldChange(id, 'name', e.target.value)
                                                            }
                                                            sx={{ width: '100%' }}
                                                       />
                                                  </TableCell>
                                                  <TableCell>
                                                       <TextField
                                                            size="small"
                                                            type="number"
                                                            value={currentWeight}
                                                            onChange={(e) =>
                                                                 handleFieldChange(id, 'maxWeight', e.target.value)
                                                            }
                                                            slotProps={{
                                                                 input: {
                                                                      endAdornment: (
                                                                           <InputAdornment position="end">
                                                                                kg
                                                                           </InputAdornment>
                                                                      ),
                                                                 },
                                                            }}
                                                            sx={{ width: '100%' }}
                                                       />
                                                  </TableCell>
                                                  <TableCell align="right">
                                                       <Tooltip title={t('common.reset')}>
                                                            <span>
                                                                 <IconButton
                                                                      size="small"
                                                                      disabled={!dirty}
                                                                      onClick={() => handleReset(id)}
                                                                 >
                                                                      <RestoreIcon fontSize="small" />
                                                                 </IconButton>
                                                            </span>
                                                       </Tooltip>
                                                       <Tooltip title={t('common.save')}>
                                                            <span>
                                                                 <IconButton
                                                                      size="small"
                                                                      color="primary"
                                                                      disabled={!dirty}
                                                                      onClick={() => handleSave(vehicle)}
                                                                 >
                                                                      <SaveIcon fontSize="small" />
                                                                 </IconButton>
                                                            </span>
                                                       </Tooltip>
                                                       <Tooltip title={t('common.delete')}>
                                                            <IconButton
                                                                 size="small"
                                                                 color="error"
                                                                 onClick={() => setDeleteTarget(vehicle)}
                                                            >
                                                                 <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                       </Tooltip>
                                                  </TableCell>
                                             </TableRow>
                                        );
                                   })}
                              </TableBody>
                         </Table>
                    </TableContainer>
               </Card>

               <CreateVehicleDrawer
                    open={createOpen}
                    onClose={() => setCreateOpen(false)}
                    onCreated={() => setCreateOpen(false)}
               />

               <ConfirmDialog
                    open={!!deleteTarget}
                    title={t('confirm.deleteTitle')}
                    message={t('confirm.deleteMessage', { entity: t('nav.vehicles').toLowerCase() })}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setDeleteTarget(null)}
                    loading={deleteMutation.isPending}
               />
          </Box>
     );
}
