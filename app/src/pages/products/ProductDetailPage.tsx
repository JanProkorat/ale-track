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

import { useProduct, useDeleteProduct } from 'src/hooks/useProducts';

import { useEnumLabel } from 'src/utils/enumTranslations';

import PageHeader from 'src/components/common/PageHeader';
import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function Field({ label, value }: { label: string; value: React.ReactNode }) {
     return (
          <Grid size={{ xs: 12, sm: 6 }}>
               <Typography variant="subtitle2">{label}</Typography>
               <Typography variant="body1">{value ?? '-'}</Typography>
          </Grid>
     );
}

// ---------------------------------------------------------------------------
// ProductDetailPage
// ---------------------------------------------------------------------------

export default function ProductDetailPage() {
     const { t } = useTranslation();
     const { id } = useParams<{ id: string }>();
     const navigate = useNavigate();
     const enumLabel = useEnumLabel();

     const { data: product, isLoading } = useProduct(id ?? '');
     const deleteMutation = useDeleteProduct();

     const [deleteOpen, setDeleteOpen] = useState(false);

     const handleDelete = () => {
          if (!id) return;
          deleteMutation.mutate(id, {
               onSuccess: () => {
                    navigate('/products');
               },
          });
     };

     if (isLoading) return <LoadingSpinner />;

     if (!product) return null;

     return (
          <Box>
               <PageHeader
                    title={product.name ?? ''}
                    action={
                         <Stack direction="row" spacing={1}>
                              <Button
                                   variant="contained"
                                   startIcon={<EditIcon />}
                                   onClick={() => navigate(`/products/${id}/edit`)}
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
                              <Field label={t('products.name')} value={product.name} />

                              <Field label={t('products.description')} value={product.description} />

                              <Field
                                   label={t('products.kind')}
                                   value={
                                        product.kind != null ? enumLabel.productKind(product.kind) : '-'
                                   }
                              />

                              <Field
                                   label={t('products.type')}
                                   value={
                                        product.type != null ? enumLabel.productType(product.type) : '-'
                                   }
                              />

                              <Field
                                   label={t('products.alcoholPercentage')}
                                   value={
                                        product.alcoholPercentage != null
                                             ? `${product.alcoholPercentage} %`
                                             : '-'
                                   }
                              />

                              <Field
                                   label={t('products.platoDegree')}
                                   value={
                                        product.platoDegree != null
                                             ? `${product.platoDegree}°`
                                             : '-'
                                   }
                              />

                              <Field
                                   label={t('products.packageSize')}
                                   value={product.packageSize != null ? product.packageSize : '-'}
                              />

                              <Field
                                   label={t('products.priceWithVat')}
                                   value={
                                        product.priceWithVat != null
                                             ? product.priceWithVat.toLocaleString(undefined, {
                                                    style: 'currency',
                                                    currency: 'CZK',
                                               })
                                             : '-'
                                   }
                              />

                              <Field
                                   label={t('products.priceForUnitWithVat')}
                                   value={
                                        product.priceForUnitWithVat != null
                                             ? product.priceForUnitWithVat.toLocaleString(undefined, {
                                                    style: 'currency',
                                                    currency: 'CZK',
                                               })
                                             : '-'
                                   }
                              />

                              <Field
                                   label={t('products.priceForUnitWithoutVat')}
                                   value={
                                        product.priceForUnitWithoutVat != null
                                             ? product.priceForUnitWithoutVat.toLocaleString(
                                                    undefined,
                                                    {
                                                         style: 'currency',
                                                         currency: 'CZK',
                                                    },
                                               )
                                             : '-'
                                   }
                              />

                              <Field
                                   label={t('products.weight')}
                                   value={
                                        product.weight != null ? `${product.weight} kg` : '-'
                                   }
                              />
                         </Grid>
                    </CardContent>
               </Card>

               <ConfirmDialog
                    open={deleteOpen}
                    title={t('confirm.deleteTitle')}
                    message={t('products.deleteConfirm', { name: product.name })}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteOpen(false)}
                    loading={deleteMutation.isPending}
               />
          </Box>
     );
}
