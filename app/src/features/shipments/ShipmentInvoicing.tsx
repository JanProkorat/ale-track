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
  Box, Button, Card, Chip, CircularProgress, Collapse, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Link, ListSubheader, MenuItem, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import CloseIcon from '@mui/icons-material/CloseOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUncheckedOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import UndoIcon from '@mui/icons-material/UndoOutlined';
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
  InvoiceLineSourceKind,
  type OrderNoteDto,
  type OrderReturnDto,
  type ShipmentInvoiceDto,
  type ShipmentInvoicesDto,
  type OutgoingShipmentStopDto,
} from 'src/generated/api-client';
import {
  useAddShipmentInvoice, useDeleteShipmentInvoice, useFileShipmentInvoicing, useMoveInvoiceLine,
  useSetInvoiceReadiness,
  useShipmentInvoices,
} from 'src/hooks/useShipmentInvoices';
import { fmtDate, fmtLiters, num, plural } from 'src/lib/format';
import {
  bandAddress, bandOrderDetails, bandOrderId, groupLineList, groupLines, groupValue, invoiceParties, invoiceQuantity,
  invoiceValue, otherClientCount,
  moveTargetOptions, originChips, partOrigin, partsByLikelihood, sectionTotals, toBands,
  PRIVATE_TARGET,
  type ClientBand,
  type LineGroup,
} from './shipmentInvoiceModel';
import { BandBillingRecipients } from './BandBillingRecipients';
import { Pill } from './Pill';
import { kindLabel, invoiceAdjustmentKindName } from 'src/lib/labels';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { colorForClient } from './clientColor';

const HEAD_SX = {
  fontSize: 11, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' as const,
  letterSpacing: '0.05em', whiteSpace: 'nowrap' as const,
};

/** Line height of a note's text, shared with the box its icon is centred in so
 *  the two line up by construction. 12.5px text at the theme's 1.5 ratio. */
const NOTE_LINE = '19px';

/** Indent that lines a vratka row up with the "Vrací" header's text: the 14px
 *  icon plus the 7px (0.875) gap that follows it. */
const RETURN_INDENT = '21px';

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
 *  Renders nothing when the address can't be resolved — see `bandAddress`. */
/** Where this band's goods go, led by the stop's position on the route.
 *
 *  The route position used to be the badge; the badge now carries the row's own
 *  fakturační number, which is what the office writes onto the invoice. It moves
 *  here rather than being dropped, because the route is still how the office and
 *  the driver talk about a stop. A payer with no delivery of its own has no
 *  position to show. */
function BandAddressLine({ band, stops }: { band: ClientBand; stops: OutgoingShipmentStopDto[] }) {
  const address = bandAddress(band, stops);
  if (!address) return null;

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25, minWidth: 0 }}>
      <PlaceOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled', flexShrink: 0 }} />
      <Typography sx={{ fontSize: 11.5, color: 'text.secondary', minWidth: 0 }} noWrap>
        {band.stopOrder !== undefined && `Zastávka ${band.stopOrder} · `}
        {address.text}
      </Typography>
      {address.placeName && (
        <Chip size="small" label={address.placeName} sx={{ height: 17, fontSize: 10.5, fontWeight: 700 }} />
      )}
    </Stack>
  );
}

/** The notes on the order behind this band, above its invoice table.
 *
 *  Inside the Collapse rather than in the header: a note is free text and can
 *  run long, and the header is deliberately two lines. Renders nothing at all
 *  when the order has none — an empty box would read as "no instructions",
 *  which is a claim this component has no business making. */
function BandNotes({ notes }: { notes: OrderNoteDto[] }) {
  if (notes.length === 0) return null;

  return (
    <Stack
      spacing={0.75}
      data-testid="band-notes"
      sx={{
        mt: 1.25, p: 1.25, borderRadius: 1.5, border: 1, borderColor: 'divider',
        bgcolor: (t) => t.vars!.palette.brand.greyTint,
      }}
    >
      {notes.map((note, i) => (
        <Stack key={note.id ?? i} direction="row" spacing={0.875} alignItems="flex-start">
          {/* The icon is centred inside a box exactly one text line tall, rather
              than nudged down by a hand-picked margin. That makes the alignment
              arithmetic instead of eyeballed, and keeps the icon on the *first*
              line when a note wraps — centring it against the whole Stack would
              float it into the middle of a three-line note. */}
          <Box sx={{ height: NOTE_LINE, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <StickyNote2OutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          </Box>
          {/* Notes are free text and often multi-line — keep the operator's breaks. */}
          <Typography sx={{ fontSize: 12.5, lineHeight: NOTE_LINE, whiteSpace: 'pre-wrap', minWidth: 0 }}>
            {note.text}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

/** The vratky this client hands back, under the band's invoice table.
 *
 *  Read-only, like the shipment's own Vratky card — returns are owned by the
 *  order. Rendered in the same idiom as that card (name, note beneath,
 *  quantity right-aligned) so a vratka looks the same wherever it appears. */
function BandReturns({ returns }: { returns: OrderReturnDto[] }) {
  if (returns.length === 0) return null;

  return (
    <Stack
      spacing={0.75}
      data-testid="band-returns"
      sx={{
        mt: 1.25, p: 1.25, borderRadius: 1.5, border: 1, borderColor: 'divider',
        bgcolor: (t) => t.vars!.palette.brand.greyTint,
      }}
    >
      {/* Headed, unlike the notes block: notes are self-evidently notes, but a
          bare list of goods sitting under the invoice table would read as more
          things being billed. The header is what says these travel the other
          way. */}
      <Stack direction="row" spacing={0.875} alignItems="center">
        <Box sx={{ width: 14, height: NOTE_LINE, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <UndoIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        </Box>
        <Typography sx={{ ...HEAD_SX, lineHeight: NOTE_LINE }}>Vrací</Typography>
      </Stack>
      {returns.map((r, i) => (
        <Stack key={r.id ?? i} direction="row" spacing={0.875} alignItems="flex-start" sx={{ pl: RETURN_INDENT }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12.5, lineHeight: NOTE_LINE }}>{r.name}</Typography>
            {r.note && (
              <Typography sx={{ fontSize: 11.5, lineHeight: NOTE_LINE }} color="text.secondary">
                {r.note}
              </Typography>
            )}
          </Box>
          <Typography sx={{ fontSize: 12.5, lineHeight: NOTE_LINE, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {r.quantity}×
          </Typography>
        </Stack>
      ))}
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
    // Keyed off the member name, not a raw `=== InvoiceAdjustmentKind.X`: enums arrive as
    // strings, so both comparisons were always false and every adjustment — removals and
    // additions alike — described itself with the fallback sentence below.
    const kindName = invoiceAdjustmentKindName(kind);
    if (kindName === 'SourceRemoved') {
      return `${label} — odebrána z nakládky, řádky faktur zrušeny (${qty} ks)`;
    }
    if (kindName === 'QuantityAdded') {
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
  // A supplier good has no kind and no package size to chip, so without this the row would be a
  // bare name among beers — and the office needs to see that this one is not a brewery's.
  const isSupplierGood = group.sourceKind === InvoiceLineSourceKind.SupplierGoodItem;

  const { stockQuantity, foreign } = originChips(invoice, group);

  return (
    <TableRow hover>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{group.name}</Typography>
          {chipText && <Chip size="small" label={chipText} sx={{ height: 19, fontSize: 10.5, fontWeight: 600 }} />}
          {isSupplierGood && (
            <Chip
              size="small"
              variant="outlined"
              label="zboží dodavatele"
              sx={{ height: 19, fontSize: 10.5, fontWeight: 600, color: 'text.secondary' }}
            />
          )}
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
  onOpenOrder,
}: {
  shipmentId: string;
  editable: boolean;
  /** The shipment's own stops, purely so each band can show where its goods
   * actually go — the invoice-split endpoint knows the client but not the
   * destination. Defaults to none so the section still renders without them. */
  stops?: OutgoingShipmentStopDto[];
  /** Opens a band's own order. Withheld from a user who cannot see orders, which is what
   *  turns the band's name back into plain text. */
  onOpenOrder?: (orderId: string) => void;
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

  return (
    <InvoicingContent
      shipmentId={shipmentId}
      editable={editable}
      data={data}
      stops={stops}
      onOpenOrder={onOpenOrder}
    />
  );
}

function InvoicingContent({ shipmentId, editable, data, stops, onOpenOrder }: {
  shipmentId: string;
  editable: boolean;
  data: ShipmentInvoicesDto;
  stops: OutgoingShipmentStopDto[];
  onOpenOrder?: (orderId: string) => void;
}) {
  const { formatMoney } = useCurrency();
  const { enqueueSnackbar } = useSnackbar();
  const move = useMoveInvoiceLine(shipmentId);
  const addInvoice = useAddShipmentInvoice(shipmentId);
  const deleteInvoice = useDeleteShipmentInvoice(shipmentId);
  const setReadiness = useSetInvoiceReadiness(shipmentId);
  const fileInvoicing = useFileShipmentInvoicing(shipmentId);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [driftDismissed, setDriftDismissed] = useState(false);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ShipmentInvoiceDto | null>(null);
  const [confirmFiling, setConfirmFiling] = useState(false);

  const bands = useMemo(() => toBands(data), [data]);
  const filed = data.isInvoicingFiled ?? false;
  // The section is read-only whenever the shipment is, and the server has the final say. Filing
  // closes it for good: past that point these rows are the record of what was filed.
  const canEdit = editable && (data.isEditable ?? false) && !filed;
  // Filing needs every row finished — the server refuses otherwise, and a button that only ever
  // errors is worse than one that says why it is waiting.
  const unfinished = bands.filter((band) => !band.isReady).length;
  const totals = useMemo(() => sectionTotals(data, bands), [bands, data]);

  // Every party key across every multi-party invoice — an invoice with one party renders no
  // party row at all, so it contributes nothing here. Shared by the seeding effect below and
  // by `setAll`: collapse-all has to close these too, not just the bands.
  const partyKeys = useMemo(() => {
    const keys: string[] = [];
    for (const invoice of data.invoices ?? []) {
      const parties = invoiceParties(invoice);
      if (parties.length > 1) {
        for (const party of parties) keys.push(`${invoice.id}:${party.clientId}`);
      }
    }
    return keys;
  }, [data.invoices]);

  // Parties open expanded by default: `collapsed` starts empty and a key's absence means
  // "expanded", so a party key simply never gets added until the user collapses it by hand.
  // No seeding effect is needed here, and that is what keeps a party the user opened from
  // being slammed shut when an invoicing mutation invalidates the query and this component
  // re-renders with an equal-but-fresh DTO.

  const toggleBand = (clientId: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(clientId)) next.delete(clientId);
    else next.add(clientId);
    return next;
  });
  // Band-scoped on purpose: the header count means bands, not parties, so opening one
  // party out of a collapsed band must not flip "Rozbalit vše" to "Sbalit vše".
  const openCount = bands.filter((b) => !collapsed.has(b.clientId)).length;
  // Extends to every party key too — rebuilding the closed set from band ids alone would
  // drop any party key already sitting in `collapsed` (every party starts collapsed) and
  // thereby *expand* it, the opposite of what "Sbalit vše" claims to do.
  const setAll = (close: boolean) =>
    setCollapsed(close ? new Set([...bands.map((b) => b.clientId), ...partyKeys]) : new Set());

  const handleAdd = (clientId: string) => {
    addInvoice.mutate(clientId, {
      onSuccess: () => {
        setCollapsed((prev) => { const n = new Set(prev); n.delete(clientId); return n; });
        enqueueSnackbar('Faktura vytvořena', { variant: 'success' });
      },
      onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
    });
  };

  const handleReadiness = (band: ClientBand, isReady: boolean) => {
    setReadiness.mutate({ clientId: band.clientId, isReady }, {
      onSuccess: () => enqueueSnackbar(
        isReady ? 'Objednávka označena jako hotová' : 'Označení hotovo zrušeno',
        { variant: 'success' }),
      onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
    });
  };

  const handleFiling = () => {
    fileInvoicing.mutate(undefined, {
      onSuccess: () => {
        setConfirmFiling(false);
        enqueueSnackbar('Fakturace zaevidována — objednávky jsou uzamčené', { variant: 'success' });
      },
      onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
    });
  };

  const handleDelete = (invoice: ShipmentInvoiceDto) => {
    deleteInvoice.mutate(invoice.id!, {
      onSuccess: () => enqueueSnackbar('Faktura smazána — kusy vráceny na fakturu plátce', { variant: 'success' }),
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
          <Typography sx={{ fontSize: 12.5, color: 'text.disabled', display: { xs: 'none', md: 'none', lg: 'block' } }}>
            Rozdělení položek vývozu na faktury — pro fakturaci klientům
          </Typography>

          {/* A spacer rather than `ml: 'auto'` on what follows: this Stack spaces its children
              with margins, and that rule outranks a child's own sx — the margin quietly won and
              the button sat next to the subtitle instead of at the edge. */}
          <Box sx={{ flex: 1 }} />

          {/* The one-way door. Up to here the office moves freely — mark a row, unmark it, correct
              an order the ordinary way, take the export again. Past it the rows lock, the orders
              close, and deviations start being recorded against them instead. Which is why it
              asks first, and why what it says afterwards is who filed it. */}
          {filed ? (
            <Tooltip title={filedTooltip(data)}>
              <Box component="span" sx={{ display: 'inline-flex' }}>
                <Pill tint="okTint" color="success.main" icon={<LockOutlinedIcon sx={{ fontSize: 12 }} />}>
                  Zaevidováno
                </Pill>
              </Box>
            </Tooltip>
          ) : editable && (data.isEditable ?? false) && (
            <Tooltip title={unfinished > 0
              ? `Nejdřív označte všechny řádky jako hotové (zbývá ${unfinished}).`
              : 'Zamkne fakturaci i objednávky. Nevratné.'}
            >
              <Box component="span" sx={{ display: 'inline-flex' }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LockOutlinedIcon fontSize="small" />}
                  disabled={unfinished > 0 || fileInvoicing.isPending}
                  onClick={() => setConfirmFiling(true)}
                  sx={{ flexShrink: 0, color: 'text.primary', borderColor: 'divider', fontWeight: 700 }}
                >
                  Zaevidovat
                </Button>
              </Box>
            </Tooltip>
          )}
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
            bands.map((band, index) => {
              const other = otherClientCount(band);
              const orderDetails = bandOrderDetails(band, stops);
              const orderId = bandOrderId(band, stops);
              const openOrder = onOpenOrder && orderId ? () => onOpenOrder(orderId) : undefined;
              return (
              <Box
                key={band.clientId}
                sx={{ py: 1.5, ...(index > 0 ? { borderTop: 1, borderColor: 'divider' } : null) }}
              >
                {/* The billing-recipients chip and the "Fakturovat na" line both come off
                    one hook instance (one query, one mutation) inside BandBillingRecipients,
                    but land in two different spots of this header — the chip in the pill
                    cluster, the line under the address. A render-prop keeps that single
                    instance while letting each piece sit where the layout needs it. */}
                <BandBillingRecipients shipmentId={shipmentId} band={band} canEdit={canEdit}>
                  {(billing) => (
                    <>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Box
                          sx={{
                            width: 26, height: 26, borderRadius: '50%', flex: '0 0 auto',
                            bgcolor: colorForClient(band.clientId), color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700,
                          }}
                        >
                          {band.number ?? '–'}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          {/* The trading name follows the client's own, dimmer and on the same
                              line: two clients can genuinely share a name, and the band header is
                              where the office recognises which one it is looking at. */}
                          <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>
                            {/* The office reads the split and then wants the order behind it. Same
                                link as the vykládka list uses, and the trading name stays outside
                                it — what is being opened is the client's order, not the name. */}
                            {openOrder ? (
                              <Link
                                component="button"
                                type="button"
                                underline="hover"
                                onClick={openOrder}
                                sx={{
                                  font: 'inherit', color: 'primary.dark', textAlign: 'left',
                                  verticalAlign: 'baseline',
                                }}
                              >
                                {band.clientName}
                              </Link>
                            ) : band.clientName}
                            {band.clientBusinessName && (
                              <Typography
                                component="span"
                                sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary' }}
                              >
                                {` · ${band.clientBusinessName}`}
                              </Typography>
                            )}
                          </Typography>
                          {/* The client's rollup used to sit here. It is deliberately
                              gone: the counts repeat on every invoice sub-header and
                              in the section total, while the destination appears
                              nowhere else on this screen. Outside the Collapse on
                              purpose — the collapsed header is what the office scans
                              down, and where the goods went is part of that scan. */}
                          <BandAddressLine band={band} stops={stops} />
                          {billing.invoicedToLine}
                        </Box>
                        {other > 0 && (
                          <Pill tint="greyTint" color="text.secondary">
                            {other} {plural(other, 'jiný klient', 'jiní klienti', 'jiných klientů')}
                          </Pill>
                        )}
                        {band.crossBilled > 0 && (
                          <Pill tint="amberTint" color="warning.dark">{band.crossBilled}× přefakturováno</Pill>
                        )}
                        {billing.chip}
                        {/* What puts the row in the export file, and what gives it its number. A
                            payer's tick covers its whole group — the sub-clients have no row of
                            their own. Deliberately not a lock: the office can still fix a mistake
                            found after ticking, exactly as before.

                            A toggle pill rather than a checkbox, so it reads as one of the states
                            in the header's chip cluster instead of a form control dropped among
                            them — and so the read-only view is the same pill without the click.
                            Only the band being written to goes disabled: one mutation object serves
                            every band, so gating on isPending alone deadened them all. */}
                        {(canEdit || band.isReady) && (
                          <Pill
                            tint={band.isReady ? 'okTint' : 'greyTint'}
                            color={band.isReady ? 'success.main' : 'text.secondary'}
                            icon={band.isReady
                              ? <CheckIcon sx={{ fontSize: 14 }} />
                              : <RadioButtonUncheckedIcon sx={{ fontSize: 13 }} />}
                            onClick={canEdit ? () => handleReadiness(band, !band.isReady) : undefined}
                            disabled={setReadiness.isPending
                              && setReadiness.variables?.clientId === band.clientId}
                            pressed={canEdit ? band.isReady : undefined}
                            ariaLabel={`${band.isReady ? 'Hotovo' : 'Označit hotovo'} – ${band.clientName}`}
                          >
                            {band.isReady ? 'Hotovo' : 'Označit hotovo'}
                          </Pill>
                        )}
                        {canEdit && (
                          <Button size="small" variant="text" startIcon={<AddIcon fontSize="small" />}
                            onClick={() => handleAdd(band.clientId)}>
                            Faktura
                          </Button>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => toggleBand(band.clientId)}
                          aria-label={collapsed.has(band.clientId) ? 'Rozbalit' : 'Sbalit'}
                          sx={{
                            width: 28, height: 28,
                            transition: (t) => t.transitions.create('transform', {
                              duration: t.transitions.duration.shortest,
                            }),
                            transform: collapsed.has(band.clientId) ? 'none' : 'rotate(180deg)',
                          }}
                        >
                          <ExpandMoreIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Stack>
                    </>
                  )}
                </BandBillingRecipients>

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
                            const parties = invoiceParties(invoice);
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
                            if (parties.length === 0) {
                              rows.push(
                                <TableRow key={`${invoice.id}-empty`}>
                                  <TableCell colSpan={4} sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                                    Zatím bez položek — přesuňte je z jiné faktury.
                                  </TableCell>
                                </TableRow>,
                              );
                            }
                            // One party is an ordinary invoice — render its rows directly, as
                            // before. Party headers appear only where there is something to
                            // separate, so an empty invoice (parties.length === 0) falls
                            // through here too and renders no product row at all.
                            if (parties.length <= 1) {
                              for (const group of groupLines(invoice)) {
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
                            }

                            for (const party of parties) {
                              const partyKey = `${invoice.id}:${party.clientId}`;
                              const open = !collapsed.has(partyKey);
                              rows.push(
                                <TableRow
                                  key={`${partyKey}-head`}
                                  hover
                                  onClick={() => toggleBand(partyKey)}
                                  sx={{ cursor: 'pointer', bgcolor: (t) => t.vars!.palette.brand.surface2 }}
                                >
                                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>
                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                      <ExpandMoreIcon
                                        sx={{
                                          fontSize: 15,
                                          transform: open ? 'rotate(180deg)' : 'none',
                                        }}
                                      />
                                      <span>{party.clientName}</span>
                                    </Stack>
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                                    {num(party.quantity)} ks
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                                    {formatMoney(party.value)}
                                  </TableCell>
                                  <TableCell />
                                </TableRow>,
                              );

                              if (!open) continue;

                              for (const group of party.groups) {
                                rows.push(
                                  <GroupRow
                                    key={`${partyKey}-${group.productKey}`}
                                    invoice={invoice}
                                    group={group}
                                    editable={canEdit}
                                    onMove={() => setMoveTarget({ invoice, group })}
                                  />,
                                );
                              }

                              // What the client's own order said and what it hands back, closing
                              // its group. Inside the table because the party row above already
                              // names the client: a block of its own underneath named it twice.
                              const detail = orderDetails.inTable.get(partyKey);
                              if (detail) {
                                rows.push(
                                  <TableRow key={`${partyKey}-detail`}>
                                    <TableCell
                                      colSpan={4}
                                      sx={{ py: 1, borderBottom: 0 }}
                                      data-testid={`party-details-${party.clientId}`}
                                    >
                                      <BandNotes notes={detail.notes} />
                                      <BandReturns returns={detail.returns} />
                                    </TableCell>
                                  </TableRow>,
                                );
                              }
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
                  {/* Below the products, not above: what the order said and what the client hands
                      back both read after what is being billed.

                      Only for a client the table never names — an ordinary band, whose whole table
                      is that one client's. Where the table does name clients, each one's detail sits
                      inside its own group instead. */}
                  {orderDetails.below.map((party) => (
                    <Box key={party.clientId} data-testid={`party-details-${party.clientId}`}>
                      <BandNotes notes={party.notes} />
                      <BandReturns returns={party.returns} />
                    </Box>
                  ))}
                </Collapse>
              </Box>
              );
            })
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
            ? `Faktura obsahuje ${invoiceQuantity(confirmDelete)} ks. Položky se vrátí na 1. fakturu plátce — u propojeného klienta na klienta, přes kterého se fakturuje.`
            : 'Faktura je prázdná.'
        }
        confirmLabel="Smazat"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={confirmFiling}
        title="Zaevidovat fakturaci?"
        message={
          'Řádky se zamknou a objednávky tohoto vývozu už nebude možné upravovat běžnou cestou — '
          + 'od té chvíle se k nim zaznamenávají změny. Tuto akci nelze vzít zpět.'
        }
        confirmLabel="Zaevidovat"
        destructive={false}
        busy={fileInvoicing.isPending}
        onConfirm={handleFiling}
        onClose={() => setConfirmFiling(false)}
      />
    </>
  );
}

/** What the filed pill says on hover: who closed the paperwork, and when. */
function filedTooltip(data: ShipmentInvoicesDto): string {
  const parts = [
    data.invoicingFiledAt ? fmtDate(data.invoicingFiledAt) : undefined,
    data.invoicingFiledByUserName,
  ].filter(Boolean);

  return parts.length > 0
    ? `Fakturace zaevidována ${parts.join(' · ')}. Objednávky jsou uzamčené.`
    : 'Fakturace je zaevidovaná. Objednávky jsou uzamčené.';
}

/** The target list groups by client and can run long, so its menu gets a scroll cap and a
 *  flat, bordered surface — a Menu paper sits at elevation 8, and MUI's dark-mode elevation
 *  overlay washes it far enough off `background.paper` to bleach the group headers. */
const MOVE_TARGET_MENU_PROPS = {
  slotProps: {
    paper: {
      sx: {
        maxHeight: 360,
        backgroundImage: 'none',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        '& .MuiList-root': { py: 0 },
      },
    },
  },
} as const;

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
            slotProps={{ select: { MenuProps: MOVE_TARGET_MENU_PROPS } }}
          >
            {options.map((o, i) => {
              const isFirstOfGroup = i === 0 || options[i - 1].group !== o.group;
              // A "+ nová faktura" row creates something rather than picking an existing
              // invoice, so it reads in the accent colour instead of the body colour.
              const creates = o.value.startsWith('new:');
              return [
                isFirstOfGroup ? (
                  <ListSubheader
                    key={`${o.group}-label`}
                    // A bare `li` inside the listbox maps to `option`; the heading is not
                    // one, so it keeps the same aria-disabled marking the old header row had.
                    aria-disabled
                    sx={{
                      px: 1.5,
                      py: 0.75,
                      lineHeight: 1.4,
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                      bgcolor: (t) => t.vars!.palette.brand.surface2,
                      borderTop: i === 0 ? 0 : 1,
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    {o.group}
                  </ListSubheader>
                ) : null,
                <MenuItem
                  key={o.value}
                  value={o.value}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    fontSize: 13.5,
                    color: creates ? 'primary.main' : 'text.primary',
                    fontWeight: creates ? 600 : 400,
                    '&.Mui-selected': {
                      bgcolor: (t) => t.vars!.palette.brand.amberTint,
                      fontWeight: 700,
                      '&:hover': { bgcolor: (t) => t.vars!.palette.brand.amberTint },
                    },
                  }}
                >
                  {o.label}
                </MenuItem>,
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
