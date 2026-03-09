import type { AddressDto } from 'src/generated/api-client';

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

import { useBrewery, useDeleteBrewery } from 'src/hooks/useBreweries';

import PageHeader from 'src/components/common/PageHeader';
import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function AddressBlock({ title, address }: { title: string; address: AddressDto }) {
     return (
          <Box>
               <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {title}
               </Typography>
               <Typography variant="body2">
                    {address.streetName} {address.streetNumber}
               </Typography>
               <Typography variant="body2">
                    {address.zip} {address.city}
               </Typography>
               <Typography variant="body2">{address.country === 1 ? 'Czechia' : 'Germany'}</Typography>
          </Box>
     );
}

// ---------------------------------------------------------------------------
// BreweryDetailPage
// ---------------------------------------------------------------------------

export default function BreweryDetailPage() {
     const { t } = useTranslation();
     const { id } = useParams<{ id: string }>();
     const navigate = useNavigate();

     const { data: brewery, isLoading } = useBrewery(id ?? '');
     const deleteMutation = useDeleteBrewery();

     const [deleteOpen, setDeleteOpen] = useState(false);

     const handleDelete = () => {
          if (!id) return;
          deleteMutation.mutate(id, {
               onSuccess: () => {
                    navigate('/breweries');
               },
          });
     };

     if (isLoading) return <LoadingSpinner />;

     if (!brewery) return null;

     return (
          <Box>
               <PageHeader
                    title={brewery.name ?? ''}
                    action={
                         <Stack direction="row" spacing={1}>
                              <Button
                                   variant="contained"
                                   startIcon={<EditIcon />}
                                   onClick={() => navigate(`/breweries/${id}/edit`)}
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
                              {/* Name */}
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Typography variant="subtitle2">{t('breweries.name')}</Typography>
                                   <Typography variant="body1">{brewery.name}</Typography>
                              </Grid>

                              {/* Color */}
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Typography variant="subtitle2">{t('breweries.color')}</Typography>
                                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                        <Box
                                             sx={{
                                                  width: 24,
                                                  height: 24,
                                                  borderRadius: '50%',
                                                  backgroundColor: brewery.color ?? '#ccc',
                                                  border: '1px solid',
                                                  borderColor: 'divider',
                                             }}
                                        />
                                        <Typography variant="body2" color="text.secondary">
                                             {brewery.color}
                                        </Typography>
                                   </Box>
                              </Grid>

                              {/* Official address */}
                              {brewery.officialAddress && (
                                   <Grid size={{ xs: 12, sm: 6 }}>
                                        <AddressBlock
                                             title={t('clients.officialAddress')}
                                             address={brewery.officialAddress}
                                        />
                                   </Grid>
                              )}

                              {/* Contact address */}
                              {brewery.contactAddress && (
                                   <Grid size={{ xs: 12, sm: 6 }}>
                                        <AddressBlock
                                             title={t('clients.contactAddress')}
                                             address={brewery.contactAddress}
                                        />
                                   </Grid>
                              )}
                         </Grid>
                    </CardContent>
               </Card>

               <ConfirmDialog
                    open={deleteOpen}
                    title={t('confirm.deleteTitle')}
                    message={t('breweries.deleteConfirm', { name: brewery.name })}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteOpen(false)}
                    loading={deleteMutation.isPending}
               />
          </Box>
     );
}
