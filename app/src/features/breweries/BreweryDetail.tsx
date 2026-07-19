import { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Button, IconButton, Tooltip, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import LocalBarIcon from '@mui/icons-material/SportsBarOutlined';
import { useSnackbar } from 'notistack';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { apiErrorMessage } from 'src/api/errors';
import { countryLabel } from 'src/lib/labels';
import { type AddressDto, type BreweryDto, type BreweryProductListItemDto } from 'src/generated/api-client';
import { useBreweryProducts, useDeleteProduct } from 'src/hooks/useBreweryProducts';
import { CenikTable } from './CenikTable';
import { ProductFormDrawer } from './ProductFormDrawer';
import { RemindersPanel } from './RemindersPanel';

function AddressCard({ title, a }: { title: string; a: AddressDto }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        <PlaceIcon fontSize="small" color="disabled" sx={{ mt: '2px' }} />
        <Box>
          <Typography>{a.streetName} {a.streetNumber}</Typography>
          <Typography>{a.zip} {a.city}</Typography>
          <Typography variant="body2" color="text.secondary">{countryLabel(a.country)}</Typography>
        </Box>
      </Stack>
    </Box>
  );
}

/** Full detail for one brewery: header actions, addresses, ceník, reminders. */
export function BreweryDetail({
  brewery,
  editable,
  onEdit,
  onDelete,
}: {
  brewery: BreweryDto;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const breweryId = brewery.id!;
  const { enqueueSnackbar } = useSnackbar();
  const products = useBreweryProducts(breweryId);
  const delProduct = useDeleteProduct(breweryId);

  const [productForm, setProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<BreweryProductListItemDto | undefined>(undefined);
  const [confirmProduct, setConfirmProduct] = useState<BreweryProductListItemDto | null>(null);

  const openAddProduct = () => { setEditingProduct(undefined); setProductForm(true); };
  const openEditProduct = (p: BreweryProductListItemDto) => { setEditingProduct(p); setProductForm(true); };
  const doDeleteProduct = async () => {
    if (!confirmProduct?.id) return;
    try {
      await delProduct.mutateAsync(confirmProduct.id);
      enqueueSnackbar('Produkt smazán.', { variant: 'success' });
      setConfirmProduct(null);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  return (
    <Box>
      {/* Header inside the tab */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
        <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: brewery.color ?? 'grey.400', flexShrink: 0 }} />
        <Typography variant="h1" sx={{ fontSize: 24 }}>{brewery.name}</Typography>
        <Box sx={{ flex: 1 }} />
        {editable && (
          <>
            <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={onEdit}>Upravit</Button>
            <Tooltip title="Smazat pivovar">
              <IconButton size="small" color="error" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton>
            </Tooltip>
          </>
        )}
      </Stack>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.6fr 1fr' }, alignItems: 'start' }}>
        {/* Ceník */}
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>Ceník</Typography>
              {editable && (
                <Button size="small" startIcon={<AddIcon />} onClick={openAddProduct}>Přidat produkt</Button>
              )}
            </Stack>
            <QueryBoundary
              query={products}
              minHeight={140}
              isEmpty={(rows) => rows.length === 0}
              emptyState={
                <EmptyState icon={<LocalBarIcon />} title="Prázdný ceník" dense
                  description="Zatím žádné produkty."
                  action={editable && <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openAddProduct}>Přidat produkt</Button>} />
              }
            >
              {(rows) => (
                <CenikTable products={rows} editable={editable} onEdit={openEditProduct} onDelete={setConfirmProduct} />
              )}
            </QueryBoundary>
          </CardContent>
        </Card>

        {/* Addresses + reminders */}
        <Stack spacing={2.5}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontSize: 16, mb: 1.5 }}>Adresa</Typography>
              <Stack spacing={2}>
                {brewery.officialAddress && <AddressCard title="Fakturační" a={brewery.officialAddress} />}
                {brewery.contactAddress && <AddressCard title="Kontaktní" a={brewery.contactAddress} />}
                {!brewery.officialAddress && <Chip label="Bez adresy" size="small" />}
              </Stack>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <RemindersPanel breweryId={breweryId} editable={editable} />
            </CardContent>
          </Card>
        </Stack>
      </Box>

      <ProductFormDrawer open={productForm} breweryId={breweryId} product={editingProduct} onClose={() => setProductForm(false)} />
      <ConfirmDialog
        open={confirmProduct !== null}
        title="Smazat produkt?"
        message={<>Opravdu smazat <strong>{confirmProduct?.name}</strong> z ceníku?</>}
        busy={delProduct.isPending}
        onConfirm={doDeleteProduct}
        onClose={() => setConfirmProduct(null)}
      />
    </Box>
  );
}
