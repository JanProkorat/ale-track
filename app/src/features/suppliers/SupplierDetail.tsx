import { type ReactNode } from 'react';
import { Alert, Box, Button, Card, Chip, IconButton, Stack, Tab, Tabs, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import ScheduleIcon from '@mui/icons-material/ScheduleOutlined';
import WalletIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import MailIcon from '@mui/icons-material/MailOutlineOutlined';
import PhoneIcon from '@mui/icons-material/PhoneOutlined';
import PropaneTankIcon from '@mui/icons-material/PropaneTankOutlined';
import TrendingDownIcon from '@mui/icons-material/TrendingDownOutlined';
import { PointMap } from 'src/components/common/PointMap';
import { DetailHeader } from 'src/components/common/DetailHeader';
import { CollapsibleCard } from 'src/components/common/CollapsibleCard';
import { StatusPill } from 'src/components/common/StatusPill';
import { DetailTabs } from 'src/components/common/DetailTabs';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { contactTypeLabel, countryLabel, isEmailContact } from 'src/lib/labels';
import {
  type AddressDto, type SupplierContactDto, type SupplierDto, type SupplierGoodDto,
} from 'src/generated/api-client';
import { GoodsPricesPanel } from './GoodsPricesPanel';
import { OpeningHoursPanel } from './OpeningHoursPanel';
import { SupplierNotesPanel } from './SupplierNotesPanel';
import { cheapestFill, priceCount } from './supplierGoods';
import { hoursOfDay, hoursText, openBadgeText, openState, openStateText, weekdayIdx } from './supplierHours';
import { type SupplierTab } from './supplierDetailTab';
import { formatZip } from './supplierFormat';

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

function StatTile({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ p: 2, minWidth: 140, flex: 1 }}>
      <Stack direction="row" alignItems="flex-start">
        <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>{label}</Typography>
        <Box sx={{ color: 'text.disabled', '& svg': { fontSize: 20 } }}>{icon}</Box>
      </Stack>
      <Typography sx={{ fontSize: 26, fontWeight: 800, mt: 1, lineHeight: 1 }}>{value}</Typography>
    </Card>
  );
}

function ContactTile({ c }: { c: SupplierContactDto }) {
  const isEmail = isEmailContact(c.type);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, minWidth: 240, flex: 1 }}>
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

/**
 * One supplier: Info a kontakty / Otevírací doba / Ceník / Poznámky.
 *
 * The header states the live open/closed answer beside the name, because that is the fact
 * a dispatcher opened the record for. `now` is injected for deterministic tests.
 */
export function SupplierDetail({
  supplier,
  editable,
  tab,
  onTabChange,
  onBack,
  backLabel = 'Zpět na dodavatele',
  onEdit,
  onDelete,
  onEditHours,
  onAddGood,
  onEditGood,
  onDeleteGood,
  now = new Date(),
}: {
  supplier: SupplierDto;
  editable: boolean;
  tab: SupplierTab;
  onTabChange: (t: SupplierTab) => void;
  onBack: () => void;
  backLabel?: string;
  onEdit: () => void;
  onDelete: () => void;
  onEditHours: () => void;
  onAddGood: () => void;
  onEditGood: (good: SupplierGoodDto) => void;
  onDeleteGood: (good: SupplierGoodDto) => void;
  now?: Date;
}) {
  const { formatMoney } = useCurrency();
  const hours = supplier.openingHours ?? [];
  const goods = supplier.goods ?? [];
  const contacts = supplier.contacts ?? [];
  const state = openState(hours, now);
  const cheapest = cheapestFill(goods);

  return (
    <>
      <DetailHeader
        onBack={onBack}
        backLabel={backLabel}
        title={supplier.name ?? ''}
        lead={openStateText(state)}
        status={<StatusPill tone={state.open ? 'ok' : 'grey'} label={openBadgeText(state)} />}
        meta={[supplier.businessName, supplier.officialAddress?.city]}
        actions={
          editable && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={onEdit}
                sx={{
                  color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', fontWeight: 700,
                  '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' },
                }}
              >
                Upravit
              </Button>
              <IconButton onClick={onDelete} aria-label="Smazat dodavatele" sx={{ color: 'error.main' }}>
                <DeleteIcon />
              </IconButton>
            </Stack>
          )
        }
      />

      <DetailTabs
        tabs={
          <Tabs
            value={tab}
            onChange={(_e, v) => onTabChange(v as SupplierTab)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab value="info" icon={<InfoIcon fontSize="small" />} iconPosition="start" label="Info a kontakty" sx={{ minHeight: 48 }} />
            <Tab value="hours" icon={<ScheduleIcon fontSize="small" />} iconPosition="start" label="Otevírací doba" sx={{ minHeight: 48 }} />
            <Tab value="cenik" icon={<WalletIcon fontSize="small" />} iconPosition="start" label={tabLabel('Ceník', goods.length)} sx={{ minHeight: 48 }} />
            <Tab value="notes" icon={<StickyNote2Icon fontSize="small" />} iconPosition="start" label="Poznámky" sx={{ minHeight: 48 }} />
          </Tabs>
        }
      >

      {tab === 'info' && (
        <Stack spacing={2}>
          {supplier.note && (
            <Alert severity="warning" icon={<InfoIcon />}>
              <Typography variant="body2">
                <strong>Než tam pošlete řidiče:</strong> {supplier.note}
              </Typography>
            </Alert>
          )}

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <TitledCard title="Fakturační adresa">
                <Stack spacing={1.5}>
                  {supplier.officialAddress && <AddressBody a={supplier.officialAddress} />}
                  <PointMap
                    lat={supplier.officialAddress?.latitude}
                    lng={supplier.officialAddress?.longitude}
                  />
                </Stack>
              </TitledCard>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <TitledCard title="Adresa provozovny">
                {supplier.contactAddress ? (
                  <Stack spacing={1.5}>
                    <AddressBody a={supplier.contactAddress} />
                    <PointMap
                      lat={supplier.contactAddress.latitude}
                      lng={supplier.contactAddress.longitude}
                    />
                  </Stack>
                ) : (
                  <Typography color="text.secondary">Shodná s fakturační adresou.</Typography>
                )}
              </TitledCard>
            </Box>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <TitledCard title="Údaje">
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Typography color="text.secondary">Obchodní název</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{supplier.businessName || '—'}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center">
                    <Typography color="text.secondary">Dnes</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <StatusPill tone={state.open ? 'ok' : 'grey'} label={openBadgeText(state)} />
                      <Typography variant="body2" color="text.secondary">
                        {hoursText(hoursOfDay(hours, weekdayIdx(now)))}
                      </Typography>
                    </Stack>
                  </Stack>
                </Stack>
              </TitledCard>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <TitledCard title="Ceník">
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                  <StatTile label="Druhů zboží" value={goods.length} icon={<PropaneTankIcon />} />
                  <StatTile label="Cen v ceníku" value={priceCount(goods)} icon={<WalletIcon />} />
                  <StatTile
                    label="Plnění od"
                    value={cheapest != null ? formatMoney(cheapest) : '—'}
                    icon={<TrendingDownIcon />}
                  />
                </Stack>
              </TitledCard>
            </Box>
          </Stack>

          <TitledCard
            title="Kontakty"
            action={
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={contacts.length} />
                {editable && (
                  <Button size="small" startIcon={<EditIcon />} onClick={onEdit} color="inherit">
                    Upravit
                  </Button>
                )}
              </Stack>
            }
          >
            {contacts.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Žádné kontakty.{editable ? ' Přidejte je tlačítkem Upravit.' : ''}
              </Typography>
            ) : (
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                {contacts.map((c, i) => <ContactTile key={i} c={c} />)}
              </Stack>
            )}
          </TitledCard>
        </Stack>
      )}

      {tab === 'hours' && (
        <OpeningHoursPanel hours={hours} editable={editable} onEdit={onEditHours} now={now} />
      )}

      {tab === 'cenik' && (
        <GoodsPricesPanel
          goods={goods}
          editable={editable}
          onAdd={onAddGood}
          onEdit={onEditGood}
          onDelete={onDeleteGood}
        />
      )}

        {tab === 'notes' && supplier.id && (
          <SupplierNotesPanel supplierId={supplier.id} editable={editable} />
        )}
      </DetailTabs>
    </>
  );
}
