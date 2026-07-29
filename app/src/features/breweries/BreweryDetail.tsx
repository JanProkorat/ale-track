import { useState, type ReactNode } from 'react';
import {
  Box, Card, Stack, Typography, Button, Tabs, Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import NotificationsIcon from '@mui/icons-material/NotificationsNoneOutlined';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import Inventory2Icon from '@mui/icons-material/Inventory2Outlined';
import SportsBarIcon from '@mui/icons-material/SportsBarOutlined';
import { useSnackbar } from 'notistack';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { CollapsibleCard } from 'src/components/common/CollapsibleCard';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { apiErrorMessage } from 'src/api/errors';
import { countryLabel } from 'src/lib/labels';
import { ProductKind, type AddressDto, type BreweryDto, type BreweryProductListItemDto } from 'src/generated/api-client';
import { useBreweryProducts, useDeleteProduct } from 'src/hooks/useBreweryProducts';
import { useBreweryReminders } from 'src/hooks/useBreweryReminders';
import { Cenik } from './Cenik';
import { ProductFormDrawer } from './ProductFormDrawer';
import { RemindersPanel } from './RemindersPanel';
import { NotesPanel } from './NotesPanel';

type SubTab = 'info' | 'cenik' | 'reminders' | 'notes';

function formatZip(zip?: string): string {
  const z = (zip ?? '').replace(/\s/g, '');
  return /^\d{5}$/.test(z) ? `${z.slice(0, 3)} ${z.slice(3)}` : (zip ?? '');
}
function addressesEqual(a?: AddressDto, b?: AddressDto): boolean {
  if (!a || !b) return false;
  return a.streetName === b.streetName && a.streetNumber === b.streetNumber && a.city === b.city && a.zip === b.zip && a.country === b.country;
}

/** Titled card matching the prototype: header band + body. */
function TitledCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <CollapsibleCard title={title} action={action}>
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </CollapsibleCard>
  );
}

function AddressBody({ a }: { a: AddressDto }) {
  return (
    <Box>
      <Typography>{a.streetName} {a.streetNumber}</Typography>
      <Typography>{formatZip(a.zip)} {a.city}, {countryLabel(a.country)}</Typography>
    </Box>
  );
}

function PrehledTile({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ p: 2, minWidth: 150 }}>
      <Stack direction="row" alignItems="flex-start">
        <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>{label}</Typography>
        <Box sx={{ color: 'text.disabled', '& svg': { fontSize: 20 } }}>{icon}</Box>
      </Stack>
      <Typography sx={{ fontSize: 30, fontWeight: 800, mt: 1, lineHeight: 1 }}>{value}</Typography>
    </Card>
  );
}

function tabLabel(text: string, count?: number) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <span>{text}</span>
      {count != null && count > 0 && (
        <Box component="span" sx={{ px: 0.9, py: 0.1, borderRadius: 999, bgcolor: 'action.selected', fontSize: 12, fontWeight: 700 }}>
          {count}
        </Box>
      )}
    </Stack>
  );
}

const isKeg = (k: BreweryProductListItemDto['kind']) =>
  (typeof k === 'number' ? ProductKind[k] : String(k ?? '')) === 'Keg';

/** Detail body for one brewery: Info / Ceník / Připomínky / Poznámky sub-tabs. */
export function BreweryDetail({ brewery, editable }: { brewery: BreweryDto; editable: boolean }) {
  const breweryId = brewery.id!;
  const { enqueueSnackbar } = useSnackbar();
  const products = useBreweryProducts(breweryId);
  const reminders = useBreweryReminders(breweryId);
  const delProduct = useDeleteProduct(breweryId);

  const [tab, setTab] = useState<SubTab>('info');
  const [productForm, setProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<BreweryProductListItemDto | undefined>(undefined);
  const [confirmProduct, setConfirmProduct] = useState<BreweryProductListItemDto | null>(null);

  const productRows = products.data ?? [];
  const reminderRows = reminders.data ?? [];
  const productCount = productRows.length;
  const kegCount = productRows.filter((p) => isKeg(p.kind)).length;
  const activeReminderCount = reminderRows.filter((r) => !r.isResolved).length;

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

  const contactSame = !brewery.contactAddress || addressesEqual(brewery.officialAddress, brewery.contactAddress);

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_e, v: SubTab) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab value="info" iconPosition="start" icon={<InfoIcon fontSize="small" />} label="Info" sx={{ minHeight: 48 }} />
          <Tab value="cenik" iconPosition="start" icon={<ReceiptIcon fontSize="small" />} label={tabLabel('Ceník', productCount)} sx={{ minHeight: 48 }} />
          <Tab value="reminders" iconPosition="start" icon={<NotificationsIcon fontSize="small" />} label={tabLabel('Připomínky', reminderRows.length)} sx={{ minHeight: 48 }} />
          <Tab value="notes" iconPosition="start" icon={<StickyNote2Icon fontSize="small" />} label="Poznámky" sx={{ minHeight: 48 }} />
        </Tabs>
      </Box>

      {tab === 'info' && (
        <Stack spacing={2.5}>
          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <TitledCard title="Fakturační adresa">
              {brewery.officialAddress ? <AddressBody a={brewery.officialAddress} /> : <Typography color="text.secondary">Bez adresy</Typography>}
            </TitledCard>
            <TitledCard title="Kontaktní adresa">
              {contactSame ? (
                <Typography color="text.secondary">Shodná s fakturační</Typography>
              ) : (
                <AddressBody a={brewery.contactAddress!} />
              )}
            </TitledCard>
          </Box>
          <TitledCard title="Přehled">
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <PrehledTile label="Produktů" value={productCount} icon={<Inventory2Icon />} />
              <PrehledTile label="Sudů" value={kegCount} icon={<SportsBarIcon />} />
              <PrehledTile label="Aktivní připomínky" value={activeReminderCount} icon={<NotificationsIcon />} />
            </Stack>
          </TitledCard>
        </Stack>
      )}

      {tab === 'cenik' && (
        <QueryBoundary
          query={products}
          minHeight={160}
          isEmpty={(rows) => rows.length === 0}
          emptyState={
            <EmptyState icon={<SportsBarIcon />} title="Prázdný ceník" description="Zatím žádné produkty."
              action={editable && <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openAddProduct}>Přidat produkt</Button>} />
          }
        >
          {(rows) => <Cenik products={rows} editable={editable} breweryId={breweryId} onAdd={openAddProduct} onEdit={openEditProduct} />}
        </QueryBoundary>
      )}

      {tab === 'reminders' && <RemindersPanel breweryId={breweryId} editable={editable} />}

      {tab === 'notes' && <NotesPanel breweryId={breweryId} editable={editable} />}

      <ProductFormDrawer
        open={productForm}
        breweryId={breweryId}
        product={editingProduct}
        onClose={() => setProductForm(false)}
        onRequestDelete={
          editingProduct ? () => { setProductForm(false); setConfirmProduct(editingProduct); } : undefined
        }
      />
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
