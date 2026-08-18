import { type ReactNode } from 'react';
import {
  Box, Card, Stack, Typography, Button, IconButton, Chip, Tabs, Tab,
} from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import NotificationsIcon from '@mui/icons-material/NotificationsNoneOutlined';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import LocationOnIcon from '@mui/icons-material/LocationOnOutlined';
import ScheduleIcon from '@mui/icons-material/ScheduleOutlined';
import MailIcon from '@mui/icons-material/MailOutlineOutlined';
import PhoneIcon from '@mui/icons-material/PhoneOutlined';
import { PointMap } from 'src/components/common/PointMap';
import { DetailHeader } from 'src/components/common/DetailHeader';
import { CollapsibleCard } from 'src/components/common/CollapsibleCard';
import { DetailTabs } from 'src/components/common/DetailTabs';
import { countryLabel, regionLabel, contactTypeLabel, isEmailContact, orderStateName } from 'src/lib/labels';
import { type AddressDto, type ClientDto, type ClientContactDto } from 'src/generated/api-client';
import { useClientReminders } from 'src/hooks/useClientReminders';
import { useClientOrders } from 'src/hooks/useOrders';
import { type SubTab } from './clientDetailTab';
import { ClientOrdersPanel } from './ClientOrdersPanel';
import { RemindersPanel } from './RemindersPanel';
import { NotesPanel } from './NotesPanel';
import { DeliveryPlacesPanel } from './DeliveryPlacesPanel';

function formatZip(zip?: string): string {
  const z = (zip ?? '').replace(/\s/g, '');
  return /^\d{5}$/.test(z) ? `${z.slice(0, 3)} ${z.slice(3)}` : (zip ?? '');
}

/** Titled card matching the prototype: header band + padded body. Owns only the
 * body padding; CollapsibleCard supplies the band and the collapse behaviour. */
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

function ContactTile({ c }: { c: ClientContactDto }) {
  const isEmail = isEmailContact(c.type);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
      <Box
        sx={{
          width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', flexShrink: 0,
          bgcolor: (t) => t.vars!.palette.brand.infoTint, color: 'info.main', '& svg': { fontSize: 18 },
        }}
      >
        {isEmail ? <MailIcon /> : <PhoneIcon />}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {c.description || contactTypeLabel(c.type)}
        </Typography>
        <Typography sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value}</Typography>
      </Box>
    </Box>
  );
}

/** Detail body for one client: Info a kontakty / Objednávky / Připomínky / Poznámky
 * sub-tabs — structured like BreweryDetail, with a page-level header (crumbs,
 * name, edit/delete) since clients don't live behind a tab strip like breweries. */
export function ClientDetail({
  client,
  editable,
  canSeeOrders,
  tab,
  onTabChange,
  onBack,
  backLabel = 'Zpět na klienty',
  onEdit,
  onDelete,
}: {
  client: ClientDto;
  editable: boolean;
  /** Resolved by the page, same as `editable`, so the detail stays renderable
   * without an auth provider. Gates the Objednávky tab and its query — the
   * orders endpoint answers 403 to a caller without the module. */
  canSeeOrders: boolean;
  /** Which sub-tab is open. Lifted to the page so it lives in the URL: an order
   * opened from the Objednávky tab returns to that tab, not to Info. */
  tab: SubTab;
  onTabChange: (tab: SubTab) => void;
  onBack: () => void;
  /** Overridden when the client was opened from elsewhere — e.g. from a garage sale, whose back
   *  arrow returns to that sale rather than dropping the user on the clients list. */
  backLabel?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const clientId = client.id!;
  const reminders = useClientReminders(clientId);
  const reminderRows = reminders.data ?? [];
  const orders = useClientOrders(canSeeOrders ? clientId : undefined);
  const orderRows = orders.data ?? [];
  const openOrderCount = orderRows.filter((o) => {
    const state = orderStateName(o.state);
    return state !== 'Finished' && state !== 'Cancelled';
  }).length;

  // A `?tab=orders` URL from a caller without the Objednávky module has no tab
  // to open — fall back rather than leaving Tabs pointed at a missing value.
  const activeTab = tab === 'orders' && !canSeeOrders ? 'info' : tab;

  const contacts = client.contacts ?? [];

  return (
    <Box>
      <DetailHeader
        onBack={onBack}
        backLabel={backLabel}
        title={client.name}
        meta={[client.businessName, regionLabel(client.region)]}
        actions={editable && (
          <>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={onEdit}
              sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', fontWeight: 700, '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } }}
            >
              Upravit
            </Button>
            <IconButton color="error" onClick={onDelete} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }} aria-label="Smazat klienta">
              <DeleteIcon />
            </IconButton>
          </>
        )}
      />

      <DetailTabs
        tabs={
        <Tabs value={activeTab} onChange={(_e, v: SubTab) => onTabChange(v)} variant="scrollable" scrollButtons="auto">
          <Tab value="info" iconPosition="start" icon={<InfoIcon fontSize="small" />} label="Info a kontakty" sx={{ minHeight: 48 }} />
          {canSeeOrders && (
            <Tab value="orders" iconPosition="start" icon={<ReceiptIcon fontSize="small" />} label={tabLabel('Objednávky', orderRows.length)} sx={{ minHeight: 48 }} />
          )}
          <Tab value="reminders" iconPosition="start" icon={<NotificationsIcon fontSize="small" />} label={tabLabel('Připomínky', reminderRows.length)} sx={{ minHeight: 48 }} />
          <Tab value="notes" iconPosition="start" icon={<StickyNote2Icon fontSize="small" />} label="Poznámky" sx={{ minHeight: 48 }} />
        </Tabs>
        }
      >

      {activeTab === 'info' && (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <TitledCard
            title="Fakturační adresa"
            action={client.officialAddress?.latitude != null && <Chip size="small" icon={<LocationOnIcon />} label="GPS" />}
          >
            {client.officialAddress ? (
              <Stack spacing={1.5}>
                <AddressBody a={client.officialAddress} />
                <PointMap lat={client.officialAddress.latitude} lng={client.officialAddress.longitude} color="#0E7C9B" />
              </Stack>
            ) : (
              <Typography color="text.secondary">Bez adresy</Typography>
            )}
          </TitledCard>

          {/* The fallback text stands in only when there is no contact address at
              all (prototype `addrCard`). One that happens to repeat the billing
              address is still an address of its own, and gets its own map. */}
          <TitledCard
            title="Kontaktní adresa"
            action={client.contactAddress?.latitude != null && <Chip size="small" icon={<LocationOnIcon />} label="GPS" />}
          >
            {client.contactAddress ? (
              <Stack spacing={1.5}>
                <AddressBody a={client.contactAddress} />
                <PointMap lat={client.contactAddress.latitude} lng={client.contactAddress.longitude} color="#0E7C9B" />
              </Stack>
            ) : (
              <Typography color="text.secondary">Shodná s fakturační adresou.</Typography>
            )}
          </TitledCard>

          <Box sx={{ gridColumn: '1 / -1' }}>
            <DeliveryPlacesPanel clientId={clientId} clientName={client.name} editable={editable} />
          </Box>

          <TitledCard title="Obchodní údaje">
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Obchodní název</Typography>
                <Typography sx={{ fontWeight: 600 }}>{client.businessName || '—'}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography color="text.secondary">Region</Typography>
                <Chip size="small" icon={<LocationOnIcon />} label={regionLabel(client.region)} />
              </Stack>
            </Stack>
          </TitledCard>

          <TitledCard title="Aktivita">
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              {/* Dashes rather than zeros without the Objednávky module: the counts
                  are unknown to this caller, not empty. */}
              <PrehledTile label="Objednávek" value={canSeeOrders ? orderRows.length : '—'} icon={<ReceiptIcon />} />
              <PrehledTile label="Otevřených" value={canSeeOrders ? openOrderCount : '—'} icon={<ScheduleIcon />} />
            </Stack>
          </TitledCard>

          <Box sx={{ gridColumn: '1 / -1' }}>
            <TitledCard
              title="Kontakty"
              action={
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Chip size="small" label={contacts.length} />
                  {editable && (
                    <Button size="small" startIcon={<EditIcon fontSize="small" />} onClick={onEdit}>
                      Upravit
                    </Button>
                  )}
                </Stack>
              }
            >
              {contacts.length > 0 ? (
                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                  {contacts.map((c, i) => <ContactTile key={i} c={c} />)}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Žádné kontakty.{editable ? ' Přidejte je tlačítkem Upravit.' : ''}
                </Typography>
              )}
            </TitledCard>
          </Box>
        </Box>
      )}

      {activeTab === 'orders' && canSeeOrders && <ClientOrdersPanel clientId={clientId} />}

      {activeTab === 'reminders' && <RemindersPanel clientId={clientId} editable={editable} />}

      {activeTab === 'notes' && <NotesPanel clientId={clientId} editable={editable} />}
      </DetailTabs>
    </Box>
  );
}
