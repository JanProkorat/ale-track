// "Fakturace" — how an outgoing shipment's items split across invoices.
//
// Separate from the nakládka card by design: nakládka tells drivers and brewery
// support what to load, this tells the office who to bill for what. They share no
// fields, and each loads its own query.
//
// Layout follows the approved prototype (docs/prototype/aletrack-prototype.html
// #/shipments/s-1, `shipInvoiceCard` and the fak* functions):
//   * one vertical band per client, in route order — never a card grid, which
//     split a client's invoices across a row boundary and left ragged holes;
//   * lines are full-width table rows, because a client normally has exactly one
//     invoice and a fixed-width card wastes most of the row;
//   * the per-invoice sub-header row only appears once a client has two or more,
//     since with one it would just repeat the band header;
//   * one row per product, with chips carrying provenance — the same product can
//     reach an invoice from several sources at once.

import { useMemo, useState } from 'react';
import {
  Box, Button, Card, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import CloseIcon from '@mui/icons-material/CloseOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLessOutlined';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMoreOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmberOutlined';
import EastIcon from '@mui/icons-material/EastOutlined';
import { useSnackbar } from 'notistack';
import { apiErrorMessage } from 'src/api/errors';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import {
  InvoiceAdjustmentKind,
  type InvoiceLineSourceKind,
  type ShipmentInvoiceDto,
  type ShipmentInvoicesDto,
  type OutgoingShipmentStopDto,
} from 'src/generated/api-client';
import {
  useAddShipmentInvoice, useDeleteShipmentInvoice, useMoveInvoiceLine, useShipmentInvoices,
} from 'src/hooks/useShipmentInvoices';
import { fmtLiters, num, plural } from 'src/lib/format';
import {
  bandAddress, groupLineList, groupLines, groupValue, invoiceQuantity, invoiceValue,
  moveTargetOptions, originChips, partOrigin, partsByLikelihood, sectionTotals, toBands,
  PRIVATE_TARGET,
  type ClientBand,
  type LineGroup,
} from './shipmentInvoiceModel';
import { kindLabel } from 'src/lib/labels';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { colorForClient } from './clientColor';

const HEAD_SX = {
  fontSize: 11, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' as const,
  letterSpacing: '0.05em', whiteSpace: 'nowrap' as const,
};

/** One line-height for all three lines of a band header, so the block has an
 *  even rhythm and the stop pin can be centred on the first line by arithmetic
 *  rather than by eye. 13.5px × 1.55 ≈ 21px. */
const LINE = 1.55;

function Pill({ tint, color, icon, children }: {
  tint: 'okTint' | 'infoTint' | 'amberTint' | 'critTint' | 'greyTint';
  color: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 23, px: 1.25,
        borderRadius: 99, fontSize: 11.5, fontWeight: 700, color,
        bgcolor: (t) => t.vars!.palette.brand[tint],
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {children}
    </Box>
  );
}

/** Small provenance chip on a product row. */
function OriginChip({ kind, label }: { kind: 'stock' | 'cross'; label: string }) {
  const isStock = kind === 'stock';
  return (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.375, height: 19, px: 0.875,
        borderRadius: 99, fontSize: 10.5, fontWeight: 700,
        color: isStock ? 'info.main' : 'warning.dark',
        bgcolor: (t) => (isStock ? t.vars!.palette.brand.infoTint : t.vars!.palette.brand.amberTint),
      }}
    >
      {isStock ? <WarehouseOutlinedIcon sx={{ fontSize: 11 }} /> : <WarningAmberIcon sx={{ fontSize: 11 }} />}
      {label}
    </Box>
  );
}

/** Where this client's goods actually go, under their name in the band header.
 *  Renders nothing when the address can't be resolved — see `bandAddress`.
 *
 *  No location glyph on purpose: the band's own coloured stop pin sits two
 *  columns to the left and already marks this as a place. A second icon here
 *  only indents this line past the client name and the counts above it, which
 *  is precisely the ragged left edge this row is trying to avoid — all three
 *  lines share one left rule. */
function BandAddressLine({ band, stops }: { band: ClientBand; stops: OutgoingShipmentStopDto[] }) {
  const address = bandAddress(band, stops);
  if (!address) return null;

  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, lineHeight: LINE }}>
      <Typography sx={{ fontSize: 11.5, lineHeight: LINE, color: 'text.secondary', minWidth: 0 }} noWrap>
        {address.text}
      </Typography>
      {address.placeName && (
        <Chip
          size="small"
          label={address.placeName}
          sx={{ height: 16, fontSize: 10, fontWeight: 700, flexShrink: 0, '& .MuiChip-label': { px: 0.75 } }}
        />
      )}
    </Stack>
  );
}

/** Banner shown when reconciliation adjusted the split because the loading changed
 *  underneath it. Dismissible per session — the server reports it on every read
 *  until the underlying items stop drifting. */
function DriftBanner({ data, onDismiss }: { data: ShipmentInvoicesDto; onDismiss: () => void }) {
  const items = data.adjustments ?? [];
  if (items.length === 0) return null;

  const describe = (kind: InvoiceAdjustmentKind | undefined, name: string | undefined, qty: number) => {
    const label = name ?? 'položka';
    if (kind === InvoiceAdjustmentKind.SourceRemoved) {
      return `${label} — odebrána z nakládky, řádky faktur zrušeny (${qty} ks)`;
    }
    if (kind === InvoiceAdjustmentKind.QuantityAdded) {
      return `${label} — přidáno ${qty} ks na 1. fakturu objednavatele`;
    }
    return `${label} — odebráno ${qty} ks (nejdřív ze soukromých, pak z přefakturovaných)`;
  };

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="flex-start"
      sx={{
        p: 1.5, mb: 1.5, borderRadius: 1.5, border: 1, borderColor: 'warning.main',
        bgcolor: (t) => t.vars!.palette.brand.amberTint,
      }}
    >
      <WarningAmberIcon sx={{ fontSize: 19, color: 'warning.dark', mt: 0.125 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
          Množství v nakládce se změnilo — rozdělení na faktury bylo upraveno
        </Typography>
        <Box component="ul" sx={{ m: 0, mt: 0.75, pl: 2.25, fontSize: 12.5, color: 'text.secondary', lineHeight: 1.65 }}>
          {items.map((a, i) => (
            <li key={i}>{describe(a.kind, a.itemName, a.quantity ?? 0)}</li>
          ))}
        </Box>
        <Typography sx={{ fontSize: 11.5, color: 'text.disabled', mt: 0.75 }}>
          Zkontrolujte rozdělení, případně kusy přesuňte ručně.
        </Typography>
      </Box>
      <IconButton size="small" onClick={onDismiss} aria-label="Skrýt hlášení" sx={{ width: 26, height: 26 }}>
        <CloseIcon sx={{ fontSize: 15 }} />
      </IconButton>
    </Stack>
  );
}

/** One product row: name, provenance chips, quantity, value, move action.
 *  A null `invoice` is the private block — the pieces are on no invoice, so the row shows
 *  no value. It carries no "soukromé" chip of its own: the block header directly above
 *  already says so, and repeating it on every row is noise. */
function GroupRow({ invoice, group, editable, onMove }: {
  invoice: ShipmentInvoiceDto | null;
  group: LineGroup;
  editable: boolean;
  onMove: () => void;
}) {
  const { formatMoney } = useCurrency();
  const isPrivate = invoice === null;
  const merged = group.parts.length > 1;
  const chipText = `${kindLabel(group.kind) ?? ''}${group.packageSize != null ? ` · ${fmtLiters(group.packageSize)}` : ''}`.replace(/^ · /, '');

  const { stockQuantity, foreign } = originChips(invoice, group);

  return (
    <TableRow hover>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{group.name}</Typography>
          {chipText && <Chip size="small" label={chipText} sx={{ height: 19, fontSize: 10.5, fontWeight: 600 }} />}
          {stockQuantity > 0 && (
            <OriginChip kind="stock" label={stockQuantity === group.quantity ? 'ze skladu' : `${stockQuantity} ks ze skladu`} />
          )}
          {foreign.map(({ clientName, quantity }) => (
            <OriginChip key={clientName} kind="cross" label={`${merged ? `${quantity} ks ` : ''}z obj. ${clientName}`} />
          ))}
        </Stack>
      </TableCell>
      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        <Typography component="span" sx={{ fontWeight: 700, fontSize: 13 }}>{group.quantity} ks</Typography>
      </TableCell>
      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: isPrivate ? 'text.disabled' : undefined }}>
        {isPrivate || group.priceWithVat == null ? '—' : formatMoney(groupValue(group))}
      </TableCell>
      <TableCell align="right" sx={{ width: 44 }}>
        {editable && (
          <IconButton
            size="small"
            onClick={onMove}
            title={isPrivate ? 'Vrátit kusy na fakturu' : 'Přesunout kusy na jinou fakturu'}
            sx={{ width: 26, height: 26 }}
          >
            <EastIcon sx={{ fontSize: 15 }} />
          </IconButton>
        )}
      </TableCell>
    </TableRow>
  );
}

interface MoveTarget {
  /** Null when the pieces being moved are the private ones. */
  invoice: ShipmentInvoiceDto | null;
  group: LineGroup;
}

/** Query states only. The split itself renders in InvoicingContent, which receives
 *  `data` as a plain prop — so nothing inside it has to cope with a missing response,
 *  and no hook can run before the data exists. An earlier version computed totals in a
 *  useMemo above the `if (!data)` guard and crashed whenever the query had no data;
 *  the `data!` assertion needed to compile that is exactly what hid the mistake. */
export function ShipmentInvoicing({
  shipmentId,
  editable,
  stops = [],
}: {
  shipmentId: string;
  editable: boolean;
  /** The shipment's own stops, purely so each band can show where its goods
   * actually go — the invoice-split endpoint knows the client but not the
   * destination. Defaults to none so the section still renders without them. */
  stops?: OutgoingShipmentStopDto[];
}) {
  const { data, isLoading, isError, error } = useShipmentInvoices(shipmentId);

  if (isLoading) {
    return (
      <Card sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Card>
    );
  }

  // Say so rather than silently rendering nothing — an invisible section reads as
  // "this shipment has nothing to invoice", which is a different and wrong message.
  if (isError || !data) {
    return (
      <Card>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
          <ReceiptLongOutlinedIcon sx={{ fontSize: 19, color: 'text.secondary' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Fakturace</Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2.5 }}>
          <WarningAmberIcon sx={{ fontSize: 19, color: 'error.main' }} />
          <Typography sx={{ fontSize: 13 }} color="text.secondary">
            {isError ? apiErrorMessage(error) : 'Rozdělení na faktury se nepodařilo načíst.'}
          </Typography>
        </Stack>
      </Card>
    );
  }

  return <InvoicingContent shipmentId={shipmentId} editable={editable} data={data} stops={stops} />;
}

function InvoicingContent({ shipmentId, editable, data, stops }: {
  shipmentId: string;
  editable: boolean;
  data: ShipmentInvoicesDto;
  stops: OutgoingShipmentStopDto[];
}) {
  const { formatMoney } = useCurrency();
  const { enqueueSnackbar } = useSnackbar();
  const move = useMoveInvoiceLine(shipmentId);
  const addInvoice = useAddShipmentInvoice(shipmentId);
  const deleteInvoice = useDeleteShipmentInvoice(shipmentId);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [driftDismissed, setDriftDismissed] = useState(false);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ShipmentInvoiceDto | null>(null);

  const bands = useMemo(() => toBands(data), [data]);
  // The section is read-only whenever the shipment is, and the server has the final say.
  const canEdit = editable && (data.isEditable ?? false);
  const totals = useMemo(() => sectionTotals(data, bands), [bands, data]);

  const toggleBand = (clientId: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(clientId)) next.delete(clientId);
    else next.add(clientId);
    return next;
  });
  const openCount = bands.filter((b) => !collapsed.has(b.clientId)).length;
  const setAll = (close: boolean) => setCollapsed(close ? new Set(bands.map((b) => b.clientId)) : new Set());

  const handleAdd = (clientId: string) => {
    addInvoice.mutate(clientId, {
      onSuccess: () => {
        setCollapsed((prev) => { const n = new Set(prev); n.delete(clientId); return n; });
        enqueueSnackbar('Faktura vytvořena', { variant: 'success' });
      },
      onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
    });
  };

  const handleDelete = (invoice: ShipmentInvoiceDto) => {
    deleteInvoice.mutate(invoice.id!, {
      onSuccess: () => enqueueSnackbar('Faktura smazána — kusy vráceny objednavateli', { variant: 'success' }),
      onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
    });
    setConfirmDelete(null);
  };

  return (
    <>
      <Card>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
          <ReceiptLongOutlinedIcon sx={{ fontSize: 19, color: 'text.secondary' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Fakturace</Typography>
          <Typography sx={{ ml: 'auto', fontSize: 12.5, color: 'text.disabled', display: { xs: 'none', md: 'block' } }}>
            Rozdělení položek vývozu na faktury — pro fakturaci klientům
          </Typography>
        </Stack>

        <Box sx={{ p: 2.5 }}>
          {!driftDismissed && <DriftBanner data={data} onDismiss={() => setDriftDismissed(true)} />}

          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Pill tint="greyTint" color="text.secondary">
                {totals.invoices} {plural(totals.invoices, 'faktura', 'faktury', 'faktur')}
                {' · '}
                {totals.clients} {plural(totals.clients, 'klient', 'klienti', 'klientů')}
              </Pill>
              <Pill tint="okTint" color="success.main">
                {totals.privateQuantity > 0 ? 'fakturováno' : 'vše rozděleno'} · {num(totals.quantity)} ks
              </Pill>
              {totals.privateQuantity > 0 && (
                <Pill tint="greyTint" color="text.secondary" icon={<LockOutlinedIcon sx={{ fontSize: 12 }} />}>
                  {num(totals.privateQuantity)} ks soukromě
                </Pill>
              )}
              {totals.crossBilled > 0 && (
                <Pill tint="amberTint" color="warning.dark">
                  {totals.crossBilled}{' '}
                  {plural(totals.crossBilled, 'položka fakturována', 'položky fakturovány', 'položek fakturováno')}
                  {' jinému klientovi'}
                </Pill>
              )}
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                Celkem{' '}
                <Typography component="span" sx={{ fontWeight: 700, color: 'warning.dark' }}>
                  {formatMoney(totals.value)}
                </Typography>
              </Typography>
              {bands.length > 1 && (
                <Button
                  size="small"
                  variant="text"
                  startIcon={openCount > 0 ? <UnfoldLessIcon fontSize="small" /> : <UnfoldMoreIcon fontSize="small" />}
                  onClick={() => setAll(openCount > 0)}
                >
                  {openCount > 0 ? 'Sbalit vše' : 'Rozbalit vše'}
                </Button>
              )}
            </Stack>
          </Stack>

          {bands.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 2 }}>
              Vývoz nemá žádné položky k fakturaci.
            </Typography>
          ) : (
            bands.map((band, index) => (
              <Box
                key={band.clientId}
                sx={{ py: 1.5, ...(index > 0 ? { borderTop: 1, borderColor: 'divider' } : null) }}
              >
                {/* Top-aligned, not centred: the block is three lines tall and
                    the pin labels the client, so it belongs beside the name
                    rather than floating down against the counts. The actions
                    opt back into centring — they act on the whole band. */}
                <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap" useFlexGap>
                  <Box
                    sx={{
                      width: 26, height: 26, borderRadius: '50%', flex: '0 0 auto',
                      bgcolor: colorForClient(band.clientId), color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                      // Centres the 26px pin on the first 21px line rather than
                      // on the block: (21 - 26) / 2.
                      mt: '-2.5px',
                    }}
                  >
                    {band.stopOrder ?? '?'}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 13.5, lineHeight: LINE }}>
                      {band.clientName}
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, lineHeight: LINE, color: 'text.secondary' }}>
                      {band.invoices.length} {plural(band.invoices.length, 'faktura', 'faktury', 'faktur')}
                      {` · ${num(band.quantity)} ks · ${formatMoney(band.value)}`}
                      {band.privateQuantity > 0 && ` · ${num(band.privateQuantity)} ks soukromě`}
                    </Typography>
                    {/* Outside the Collapse on purpose: the collapsed header is
                        what the office scans down, and where the goods went is
                        part of that scan. */}
                    <BandAddressLine band={band} stops={stops} />
                  </Box>
                  {band.crossBilled > 0 && (
                    <Box sx={{ alignSelf: 'center', flexShrink: 0 }}>
                      <Pill tint="amberTint" color="warning.dark">{band.crossBilled}× přefakturováno</Pill>
                    </Box>
                  )}
                  {canEdit && (
                    <Button size="small" variant="text" startIcon={<AddIcon fontSize="small" />}
                      onClick={() => handleAdd(band.clientId)}
                      sx={{ alignSelf: 'center', flexShrink: 0 }}>
                      Faktura
                    </Button>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => toggleBand(band.clientId)}
                    aria-label={collapsed.has(band.clientId) ? 'Rozbalit' : 'Sbalit'}
                    sx={{
                      width: 28, height: 28, alignSelf: 'center', flexShrink: 0,
                      transition: (t) => t.transitions.create('transform', {
                        duration: t.transitions.duration.shortest,
                      }),
                      transform: collapsed.has(band.clientId) ? 'none' : 'rotate(180deg)',
                    }}
                  >
                    <ExpandMoreIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Stack>

                <Collapse in={!collapsed.has(band.clientId)} unmountOnExit>
                  <Card variant="outlined" sx={{ mt: 1.25 }}>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: (t) => t.vars!.palette.brand.surface2 }}>
                            <TableCell sx={HEAD_SX}>Produkt</TableCell>
                            <TableCell align="right" sx={{ ...HEAD_SX, width: 100 }}>Množství</TableCell>
                            <TableCell align="right" sx={{ ...HEAD_SX, width: 130 }}>Hodnota</TableCell>
                            <TableCell sx={{ width: 44 }} />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {band.invoices.flatMap((invoice) => {
                            const groups = groupLines(invoice);
                            const rows = [];
                            // Only label individual invoices once the client has more than one.
                            if (band.invoices.length > 1) {
                              rows.push(
                                <TableRow key={`${invoice.id}-head`} sx={{ bgcolor: (t) => t.vars!.palette.brand.surface2 }}>
                                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Faktura {invoice.sequence}</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                                    {invoiceQuantity(invoice)} ks
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: 'warning.dark', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatMoney(invoiceValue(invoice))}
                                  </TableCell>
                                  <TableCell align="right">
                                    {canEdit && (invoice.sequence ?? 1) > 1 && (
                                      <IconButton size="small" color="error" title="Smazat fakturu"
                                        onClick={() => setConfirmDelete(invoice)} sx={{ width: 26, height: 26 }}>
                                        <DeleteOutlineOutlinedIcon sx={{ fontSize: 15 }} />
                                      </IconButton>
                                    )}
                                  </TableCell>
                                </TableRow>,
                              );
                            }
                            if (groups.length === 0) {
                              rows.push(
                                <TableRow key={`${invoice.id}-empty`}>
                                  <TableCell colSpan={4} sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                                    Zatím bez položek — přesuňte je z jiné faktury.
                                  </TableCell>
                                </TableRow>,
                              );
                            }
                            for (const group of groups) {
                              rows.push(
                                <GroupRow
                                  key={`${invoice.id}-${group.productKey}`}
                                  invoice={invoice}
                                  group={group}
                                  editable={canEdit}
                                  onMove={() => setMoveTarget({ invoice, group })}
                                />,
                              );
                            }
                            return rows;
                          })}

                          {/* Pieces this client ordered that go on no invoice at all. Its own
                              block below the client's invoices, never mixed into one. */}
                          {band.privateLines.length > 0 && [
                            <TableRow key="private-head" sx={{ bgcolor: (t) => t.vars!.palette.brand.surface2 }}>
                              <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                  <LockOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                  <span>Soukromé · nefakturováno</span>
                                </Stack>
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                                {num(band.privateQuantity)} ks
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: 'text.disabled' }}>—</TableCell>
                              <TableCell />
                            </TableRow>,
                            ...groupLineList(band.privateLines).map((group) => (
                              <GroupRow
                                key={`private-${group.productKey}`}
                                invoice={null}
                                group={group}
                                editable={canEdit}
                                onMove={() => setMoveTarget({ invoice: null, group })}
                              />
                            )),
                          ]}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Card>
                </Collapse>
              </Box>
            ))
          )}
        </Box>
      </Card>

      {moveTarget && (
        <MoveDialog
          data={data}
          target={moveTarget}
          pending={move.isPending}
          onClose={() => setMoveTarget(null)}
          onSubmit={(args) => {
            move.mutate(args, {
              onSuccess: () => {
                setMoveTarget(null);
                enqueueSnackbar(args.toPrivate ? 'Kusy označeny jako soukromé' : 'Kusy přesunuty', {
                  variant: 'success',
                });
              },
              onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
            });
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete != null}
        title="Smazat fakturu?"
        message={
          confirmDelete && invoiceQuantity(confirmDelete) > 0
            ? `Faktura obsahuje ${invoiceQuantity(confirmDelete)} ks. Položky se vrátí na 1. fakturu klienta, který je objednal.`
            : 'Faktura je prázdná.'
        }
        confirmLabel="Smazat"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  );
}

/** Moves a partial quantity to another invoice — including one of a different client, or
 *  off invoicing altogether. Opened from the private block it works the other way round:
 *  the pieces come off the private ones and go back onto an invoice.
 *  When the row merges several sources, the origin has to be picked explicitly and the
 *  quantity cap follows that choice, not the row total. */
function MoveDialog({ data, target, pending, onClose, onSubmit }: {
  data: ShipmentInvoicesDto;
  target: MoveTarget;
  pending: boolean;
  onClose: () => void;
  onSubmit: (args: {
    fromInvoiceId?: string; sourceKind: InvoiceLineSourceKind; sourceItemId: string;
    quantity: number; toInvoiceId?: string; toClientId?: string; toPrivate?: boolean;
  }) => void;
}) {
  const { invoice, group } = target;
  // Biggest part first, so the default pick is the most likely one.
  const parts = useMemo(() => partsByLikelihood(group), [group]);
  const [partId, setPartId] = useState(parts[0]?.id ?? '');
  const selected = parts.find((p) => p.id === partId) ?? parts[0];
  const max = selected?.quantity ?? 0;
  const [quantity, setQuantity] = useState(String(max));

  // Targets grouped per client: their existing invoices, plus a new one.
  const options = useMemo(() => moveTargetOptions(data, invoice, group), [data, invoice, group]);
  // Preselect the first target so the dialog opens ready to submit. Options are built in
  // route order starting with the source's own client, so the default is another invoice of
  // the same client — never a silent cross-billing to somebody else.
  const [targetValue, setTargetValue] = useState(options[0]?.value ?? '');

  const qty = Number.parseInt(quantity, 10);
  const qtyError = !Number.isFinite(qty) || qty <= 0 || qty > max;

  const submit = () => {
    if (qtyError || !targetValue || !selected) return;
    const [kind, id] = targetValue.split(':');
    onSubmit({
      // Omitted when the pieces come off the private ones — there is no origin invoice.
      fromInvoiceId: invoice?.id,
      sourceKind: selected.sourceKind!,
      sourceItemId: selected.sourceItemId!,
      quantity: qty,
      toInvoiceId: kind === 'inv' ? id : undefined,
      toClientId: kind === 'new' ? id : undefined,
      toPrivate: targetValue === PRIVATE_TARGET ? true : undefined,
    });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <EastIcon sx={{ fontSize: 20 }} />
        <Box component="span" sx={{ flex: 1 }}>
          {invoice ? 'Přesunout na jinou fakturu' : 'Vrátit soukromé kusy na fakturu'}
        </Box>
        <IconButton onClick={onClose} aria-label="Zavřít" size="small">
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={1.5} alignItems="center"
          sx={{ p: 1.5, mb: 2, border: 1, borderColor: 'divider', borderRadius: 1.5, bgcolor: (t) => t.vars!.palette.brand.surface2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{group.name}</Typography>
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
              {invoice ? `z ${invoice.clientName} · Faktura ${invoice.sequence}` : 'ze soukromých kusů'}
              {parts.length > 1 && ` · ${parts.length} zdroje`}
            </Typography>
          </Box>
          <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{group.quantity} ks</Typography>
        </Stack>

        <Stack spacing={2}>
          {parts.length > 1 && (
            <TextField
              select
              label="Původ kusů"
              value={partId}
              onChange={(e) => {
                setPartId(e.target.value);
                const next = parts.find((p) => p.id === e.target.value);
                setQuantity(String(next?.quantity ?? 0));
              }}
              helperText={invoice
                ? 'Tento produkt je na faktuře z více zdrojů. Přesouvá se vždy z jednoho z nich.'
                : 'Tyto kusy pocházejí z více zdrojů. Přesouvá se vždy z jednoho z nich.'}
              fullWidth
            >
              {parts.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {partOrigin(invoice, p)} — {p.quantity} ks
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            label="Počet kusů k přesunu"
            type="number"
            autoFocus
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={qtyError}
            helperText={`Ze zvoleného zdroje lze přesunout nejvýš ${max} ks. Zbytek zůstane zde.`}
            fullWidth
          />

          <TextField
            select
            label="Cílová faktura"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            helperText={invoice
              ? 'Můžete zvolit i fakturu jiného klienta — položka se označí jako přefakturovaná. Volbou „Soukromé“ kusy z fakturace vyřadíte.'
              : 'Kusy se vrátí na zvolenou fakturu a budou se opět fakturovat.'}
            fullWidth
          >
            {options.map((o, i) => {
              const isFirstOfGroup = i === 0 || options[i - 1].group !== o.group;
              return [
                isFirstOfGroup ? (
                  <MenuItem key={`${o.group}-label`} disabled sx={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', opacity: 1, color: 'text.disabled' }}>
                    {o.group}
                  </MenuItem>
                ) : null,
                <MenuItem key={o.value} value={o.value} sx={{ pl: 3 }}>{o.label}</MenuItem>,
              ];
            })}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" variant="outlined">Zrušit</Button>
        <Button
          onClick={submit}
          variant="contained"
          startIcon={<EastIcon />}
          disabled={pending || qtyError || !targetValue}
        >
          Přesunout
        </Button>
      </DialogActions>
    </Dialog>
  );
}
