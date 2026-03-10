import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import EditIcon from '@mui/icons-material/Edit';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DeleteIcon from '@mui/icons-material/Delete';

import { useDriver, useDeleteDriver } from 'src/hooks/useDrivers';

import PageHeader from 'src/components/common/PageHeader';
import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

// ---------------------------------------------------------------------------
// DriverDetailPage
// ---------------------------------------------------------------------------

export default function DriverDetailPage() {
     const { t } = useTranslation();
     const { id } = useParams<{ id: string }>();
     const navigate = useNavigate();

     const { data: driver, isLoading } = useDriver(id ?? '');
     const deleteMutation = useDeleteDriver();

     const [deleteOpen, setDeleteOpen] = useState(false);

     const handleDelete = () => {
          if (!id) return;
          deleteMutation.mutate(id, {
               onSuccess: () => {
                    navigate('/drivers');
               },
          });
     };

     if (isLoading) return <LoadingSpinner />;

     if (!driver) return null;

     const fullName = `${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim();

     return (
          <Box>
               <PageHeader
                    title={fullName}
                    action={
                         <Stack direction="row" spacing={1}>
                              <Button
                                   variant="contained"
                                   startIcon={<EditIcon />}
                                   onClick={() => navigate(`/drivers/${id}/edit`)}
                              >
                                   {t('common.edit')}
                              </Button>
                              <Button
                                   variant="outlined"
                                   color="error"
                                   startIcon={<DeleteIcon />}
                                   onClick={() => setDeleteOpen(true)}
                              >
                                   {t('common.delete')}
                              </Button>
                         </Stack>
                    }
               />

               <Card>
                    <CardContent>
                         <Grid container spacing={3}>
                              {/* First Name */}
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Typography variant="subtitle2">{t('drivers.firstName')}</Typography>
                                   <Typography variant="body1">{driver.firstName}</Typography>
                              </Grid>

                              {/* Last Name */}
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Typography variant="subtitle2">{t('drivers.lastName')}</Typography>
                                   <Typography variant="body1">{driver.lastName}</Typography>
                              </Grid>

                              {/* Phone Number */}
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Typography variant="subtitle2">{t('drivers.phoneNumber')}</Typography>
                                   <Typography variant="body1">{driver.phoneNumber || '—'}</Typography>
                              </Grid>

                              {/* Color */}
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Typography variant="subtitle2">{t('drivers.color')}</Typography>
                                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                        <Box
                                             sx={{
                                                  width: 24,
                                                  height: 24,
                                                  borderRadius: '50%',
                                                  backgroundColor: driver.color ?? '#ccc',
                                                  border: '1px solid',
                                                  borderColor: 'divider',
                                             }}
                                        />
                                        <Typography variant="body2" color="text.secondary">
                                             {driver.color}
                                        </Typography>
                                   </Box>
                              </Grid>

                              {/* Availability dates */}
                              <Grid size={12}>
                                   <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                        {t('drivers.availability')}
                                   </Typography>

                                   {driver.availableDates && driver.availableDates.length > 0 ? (
                                        <Stack spacing={1}>
                                             {driver.availableDates.map((avail, index) => (
                                                  <Typography key={index} variant="body2">
                                                       {avail.from ? dayjs(avail.from).format('L') : '—'}
                                                       {' — '}
                                                       {avail.until ? dayjs(avail.until).format('L') : '—'}
                                                  </Typography>
                                             ))}
                                        </Stack>
                                   ) : (
                                        <Typography variant="body2" color="text.secondary">
                                             {t('common.noData')}
                                        </Typography>
                                   )}
                              </Grid>
                         </Grid>
                    </CardContent>
               </Card>

               <ConfirmDialog
                    open={deleteOpen}
                    title={t('confirm.deleteTitle')}
                    message={t('drivers.deleteConfirm', { name: fullName })}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteOpen(false)}
                    loading={deleteMutation.isPending}
               />
          </Box>
     );
}
