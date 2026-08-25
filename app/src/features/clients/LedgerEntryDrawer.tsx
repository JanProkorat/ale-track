// The one form that records what actually happened. Opened from a stop in the run's Vykládka,
// from an order detail, and from a client profile — three contexts, one drawer, because a
// second copy of the upsert rules is how two screens end up disagreeing about a debt.
//
// The trap this whole file is built around: the "Skutečně" column is prefilled from the STORED
// deviation, not from the plan. A dispatcher records "unloaded 7 of 10", reopens the form an hour
// later and saves again; prefilling from the plan would record the −3 a second time and leave the
// client owing six kegs. Saving is an upsert, and every planned line is sent — including the
// unchanged ones, because a line returning to its planned value is how a stored deviation gets
// deleted.

import { useEffect, useMemo, useState } from 'react';
import {
  Box, CircularProgress, Divider, IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { apiErrorMessage } from 'src/api/errors';
import { fmtLiters } from 'src/lib/format';
import { kindLabel } from 'src/lib/labels';
import {
  ClientLedgerEntryTarget,
  ClientLedgerRowDto,
  SaveClientLedgerEntriesDto,
  UpdateClientLedgerEntryDto,
  type IClientLedgerRowDto,
  type ClientLedgerEntryDto,
} from 'src/generated/api-client';
import { useClientProductHistory } from 'src/hooks/useOrders';
import { useBreweryColors } from 'src/hooks/useBreweries';
import { ProductCatalogBrowser } from 'src/features/orders/ProductCatalog';
import { catalogByProductId } from 'src/features/orders/clientPrices';
import {
  useDeleteClientLedgerEntry,
  useSaveClientLedgerEntries,
  useUpdateClientLedgerEntry,
} from 'src/hooks/useClientLedger';
import {
  deliveredEntryFor,
  doorSideAdditions,
  entriesForTarget,
  isFreeEntry,
  quantityTone,
  quantityWords as deviationWords,
  TONE_COLOR,
  type LedgerTone,
  type PlanRow,
} from './ledgerModel';
import { LedgerTag, TextDiff } from './LedgerDiff';

/** What the screen opening the drawer already knows about the handover. */
export interface LedgerDrawerContext {
  clientId: string;
  clientName: string;
  /** Omitted on a client profile: there is no delivery to diff, only free rows. */
  orderId?: string;
  /** Order number and state, for the drawer's own subtitle. */
  orderLabel?: string;
  items?: PlanRow[];
  goods?: PlanRow[];
  returns?: PlanRow[];
  extras?: PlanRow[];
  /**
   * Products the order's own lines are for.
   *
   * Kept apart from `items`, whose keys are order-item ids: taking more of a product the order
   * plans is an over-delivery on that line, recorded in the Skutečně column above, so the catalog
   * must not offer it a second time as something taken at the door.
   */
  itemProductIds?: string[];
  /** The order's recorded deviations, so the actual column can be prefilled from them. */
  entries?: ClientLedgerEntryDto[];
}

/** A row of one of the drawer's tables: the plan, and the number being typed over it. */
interface EditableRow extends PlanRow {
  actual: string;
  entry?: ClientLedgerEntryDto;
}

/** A line added in the drawer for something the order never planned. */
interface NewLine {
  name: string;
  quantity: string;
}

/**
 * A product taken at the door: no line on the order, so it is keyed by the product.
 *
 * Rows arrive two ways — from an entry an earlier pass wrote, or from the catalog below. Only the
 * first has an `entryId`, which is what separates "set this to zero so the server deletes it"
 * from "never mind, it was never saved".
 */
interface AddedRow {
  entryId?: string;
  productId: string;
  name: string;
  actual: string;
}

const EMPTY_NEW_LINE: NewLine = { name: '', quantity: '' };

function toEditable(rows: PlanRow[], entries: ClientLedgerEntryDto[]): EditableRow[] {
  return rows.map((row) => {
    const entry = deliveredEntryFor(entries, row.key);
    // The stored actual where there is one — see the note at the top of this file.
    const delta = entry ? (entry.actualQuantity ?? 0) - (entry.plannedQuantity ?? 0) : 0;
    return { ...row, entry, actual: String(Math.max(0, row.quantity + delta)) };
  });
}

/** Quantity typed into a cell, floored at zero; a blank cell means "as planned". */
function parsed(value: string, fallback: number): number {
  if (value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function LedgerEntryDrawer({
  open,
  context,
  onClose,
}: {
  open: boolean;
  context: LedgerDrawerContext;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const save = useSaveClientLedgerEntries();
  const updateEntry = useUpdateClientLedgerEntry();
  const deleteEntry = useDeleteClientLedgerEntry();

  // The client's own catalog, not the plain product list: it arrives already grouped by brewery
  // and kind, and its prices are this client's rather than the list ones — the same source the
  // order editor prices a new line from, so the two screens cannot quote different money.
  const catalog = useClientProductHistory(context.clientId || undefined);
  // The square that marks a brewery across every catalog surface. Without it the panels render
  // a grey placeholder, which reads as "no colour" rather than as this brewery's.
  const colorForBrewery = useBreweryColors();
  const productsById = useMemo(() => catalogByProductId(catalog.data), [catalog.data]);

  /** Packaging under a door-side product's name, the way the catalog labels it. */
  const chipFor = (productId: string) => {
    const product = productsById.get(productId);
    if (!product) return undefined;
    return [kindLabel(product.kind), product.packageSize != null ? fmtLiters(product.packageSize) : '']
      .filter(Boolean)
      .join(' · ') || undefined;
  };

  // Memoised: the fallback array is a fresh value on every render, which would make the two
  // lookups below recompute each time.
  const entries = useMemo(() => context.entries ?? [], [context.entries]);
  const hasOrder = Boolean(context.orderId);

  const [items, setItems] = useState<EditableRow[]>([]);
  const [goods, setGoods] = useState<EditableRow[]>([]);
  const [returns, setReturns] = useState<EditableRow[]>([]);
  const [extras, setExtras] = useState<EditableRow[]>([]);
  const [added, setAdded] = useState<AddedRow[]>([]);
  const [newReturn, setNewReturn] = useState<NewLine>(EMPTY_NEW_LINE);
  const [newExtra, setNewExtra] = useState<NewLine>(EMPTY_NEW_LINE);
  const [money, setMoney] = useState('');
  const [note, setNote] = useState('');

  // The money entry is the one free row the drawer owns rather than appends: re-saving the form
  // with the same amount must correct it, not open a second debt beside it. Money rows are
  // otherwise appended, which is what lets a client profile hold several at once.
  const moneyEntry = useMemo(
    () => entries.find((e) => isFreeEntry(e) && e.amount != null && !e.resolvedAt),
    [entries],
  );

  const addressEntry = useMemo(
    () => entries.find((e) => e.plannedText != null || e.actualText != null),
    [entries],
  );

  // Refilled every time the drawer opens, so a second visit starts from what is stored rather
  // than from whatever was typed and abandoned last time.
  useEffect(() => {
    if (!open) return;
    setItems(toEditable(context.items ?? [], entriesForTarget(entries, 'ProductQuantity')));
    setGoods(toEditable(context.goods ?? [], entriesForTarget(entries, 'SupplierGoodQuantity')));
    setReturns(toEditable(context.returns ?? [], entriesForTarget(entries, 'ReturnQuantity')));
    setExtras(toEditable(context.extras ?? [], entriesForTarget(entries, 'CustomExtraQuantity')));
    setAdded(doorSideAdditions(entries).map((e) => ({
      entryId: e.id,
      productId: e.productId ?? '',
      name: e.productName ?? '—',
      actual: String(e.actualQuantity ?? 0),
    })));
    setNewReturn(EMPTY_NEW_LINE);
    setNewExtra(EMPTY_NEW_LINE);
    setMoney(moneyEntry?.amount != null ? String(moneyEntry.amount) : '');
    setNote(moneyEntry?.note ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, context.orderId, context.clientId]);

  // What the catalog shows as already taken. Keyed by product, which is how a door-side addition
  // is keyed everywhere else.
  const addedQuantities = useMemo(
    () => new Map(added.map((row) => [row.productId, parsed(row.actual, 0)])),
    [added],
  );

  // Products the order itself plans. Taking more of one of those is an over-delivery on its own
  // line, recorded in the Skutečně column above — offering it here as well would write a second
  // entry for one product, and the two would disagree.
  const onOrder = useMemo(
    () => new Set<string | undefined>(context.itemProductIds ?? []),
    [context.itemProductIds],
  );

  /** Puts a product on the form at one piece, or brings a row that was zeroed back to one. */
  const addProduct = (productId: string) => {
    const name = productsById.get(productId)?.name ?? '—';
    setAdded((prev) => (prev.some((r) => r.productId === productId)
      ? prev.map((r) => (r.productId === productId ? { ...r, actual: '1' } : r))
      : [...prev, { productId, name, actual: '1' }]));
  };

  /**
   * Steps a row by the catalog's +/−.
   *
   * A row the server already knows about stays at zero rather than disappearing: zero is what
   * tells the server to delete the entry, so dropping the row would leave it stored. One that was
   * never saved is simply forgotten.
   */
  const changeProductQty = (productId: string, delta: number) => {
    setAdded((prev) => prev.flatMap((row) => {
      if (row.productId !== productId) return [row];
      const next = Math.max(0, parsed(row.actual, 0) + delta);
      if (next === 0 && !row.entryId) return [];
      return [{ ...row, actual: String(next) }];
    }));
  };

  const busy = save.isPending || updateEntry.isPending || deleteEntry.isPending;

  /**
   * Builds the batch. Every planned line goes in, unchanged ones included: the server deletes a
   * stored deviation when it is told the line is back at its planned value, so leaving those out
   * would strand a correction the operator just undid.
   */
  const buildRows = (): ClientLedgerRowDto[] => {
    const rows: ClientLedgerRowDto[] = [];

    // Constructed, never cast: the generated SaveClientLedgerEntriesDto.toJSON() calls toJSON()
    // on every row, so a plain object literal type-checks and then throws on save.
    const push = (row: IClientLedgerRowDto) => rows.push(new ClientLedgerRowDto(row));

    for (const row of items) {
      push({
        target: ClientLedgerEntryTarget.ProductQuantity,
        orderItemId: row.key,
        plannedQuantity: row.quantity,
        actualQuantity: parsed(row.actual, row.quantity),
      });
    }
    for (const row of goods) {
      push({
        target: ClientLedgerEntryTarget.SupplierGoodQuantity,
        supplierGoodItemId: row.key,
        plannedQuantity: row.quantity,
        actualQuantity: parsed(row.actual, row.quantity),
      });
    }
    for (const row of returns) {
      push({
        target: ClientLedgerEntryTarget.ReturnQuantity,
        orderReturnId: row.key,
        plannedQuantity: row.quantity,
        actualQuantity: parsed(row.actual, row.quantity),
      });
    }
    for (const row of extras) {
      push({
        target: ClientLedgerEntryTarget.CustomExtraQuantity,
        customExtraItemId: row.key,
        plannedQuantity: row.quantity,
        actualQuantity: parsed(row.actual, row.quantity),
      });
    }

    // Products taken at the door — whether picked from the catalog just now or corrected from an
    // earlier pass. Keyed by product, which is how the server pairs a row with the entry it wrote;
    // zero says the two agree again, which deletes it. A row at zero that was never saved has
    // nothing to delete and is left out.
    for (const row of added) {
      const quantity = parsed(row.actual, 0);
      if (quantity === 0 && !row.entryId) continue;

      push({
        target: ClientLedgerEntryTarget.ProductQuantity,
        productId: row.productId,
        plannedQuantity: 0,
        actualQuantity: quantity,
      });
    }

    const returnQty = parsed(newReturn.quantity, 0);
    if (newReturn.name.trim() && returnQty > 0) {
      push({
        target: ClientLedgerEntryTarget.ReturnQuantity,
        lineName: newReturn.name.trim(),
        plannedQuantity: 0,
        actualQuantity: returnQty,
      });
    }

    const extraQty = parsed(newExtra.quantity, 0);
    if (newExtra.name.trim() && extraQty > 0) {
      push({
        target: ClientLedgerEntryTarget.CustomExtraQuantity,
        lineName: newExtra.name.trim(),
        plannedQuantity: 0,
        actualQuantity: extraQty,
      });
    }

    // A note with no amount is still worth keeping: "volal, ozve se" is a thing to follow up.
    const amount = money.trim() === '' ? null : Number(money);
    if (!moneyEntry && amount != null && Number.isFinite(amount) && amount !== 0) {
      push({ target: ClientLedgerEntryTarget.Money, amount, note: note.trim() || undefined });
    } else if (!moneyEntry && amount == null && note.trim()) {
      push({ target: ClientLedgerEntryTarget.Other, note: note.trim() });
    }

    return rows;
  };

  const submit = async () => {
    const amount = money.trim() === '' ? null : Number(money);

    try {
      const rows = buildRows();
      if (rows.length > 0) {
        await save.mutateAsync({
          clientId: context.clientId,
          data: new SaveClientLedgerEntriesDto({ orderId: context.orderId, rows }),
        });
      }

      // The money row the drawer already owns is corrected or dropped rather than appended.
      if (moneyEntry?.id) {
        if (amount == null || !Number.isFinite(amount) || amount === 0) {
          await deleteEntry.mutateAsync({ id: moneyEntry.id, clientId: context.clientId });
        } else if (amount !== moneyEntry.amount || note.trim() !== (moneyEntry.note ?? '')) {
          await updateEntry.mutateAsync({
            id: moneyEntry.id,
            clientId: context.clientId,
            data: new UpdateClientLedgerEntryDto({ amount, note: note.trim() || undefined }),
          });
        }
      }

      enqueueSnackbar('Změny zaznamenány.', { variant: 'success' });
      onClose();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  const quantityTable = (
    title: string,
    actualLabel: string,
    rows: EditableRow[],
    setRows: (rows: EditableRow[]) => void,
    unit: string,
    options: { isReturn?: boolean; appended?: React.ReactNode } = {},
  ) => (
    <Box>
      <SectionLabel>{title}</SectionLabel>
      {rows.length === 0 && !options.appended ? (
        <Typography variant="body2" color="text.secondary" sx={{ pb: 1 }}>
          Objednávka žádné neplánovala.
        </Typography>
      ) : (
        <Stack spacing={0.75}>
          <ColumnHeads actualLabel={actualLabel} />
          {rows.map((row, index) => {
            const actual = parsed(row.actual, row.quantity);
            const tone = quantityTone(row.quantity, actual, options.isReturn);
            return (
              <QuantityRow
                key={row.key}
                name={row.name}
                chip={row.chip}
                tone={tone}
                tag={tone && deviationWords(row.quantity, actual, options.isReturn)}
                planned={`${row.quantity} ${unit}`}
                value={row.actual}
                inputLabel={`${row.name} — ${actualLabel}`}
                onValue={(value) => {
                  const next = [...rows];
                  next[index] = { ...row, actual: value };
                  setRows(next);
                }}
              />
            );
          })}
          {options.appended}
        </Stack>
      )}
    </Box>
  );

  /**
   * The products taken at the door, as rows of the table above rather than a section of their own.
   *
   * They belong there: the operator is reading one list of what the client ended up with, and a
   * second heading between it and the catalog made them look like a different kind of thing.
   */
  const doorSideRows = added.map((row, index) => (
    <QuantityRow
      key={row.productId}
      name={row.name}
      chip={chipFor(row.productId)}
      tone="new"
      tag="Přidáno na místě"
      value={row.actual}
      inputLabel={`${row.name} — vzato na místě`}
      onValue={(value) => {
        const next = [...added];
        next[index] = { ...row, actual: value };
        setAdded(next);
      }}
      // A stored row is zeroed rather than dropped: zero is what tells the server to delete the
      // entry, so removing the row would leave it saved. One picked from the catalog a moment ago
      // has nothing stored and simply goes.
      onRemove={() => setAdded((prev) => (row.entryId
        ? prev.map((r) => (r.productId === row.productId ? { ...r, actual: '0' } : r))
        : prev.filter((r) => r.productId !== row.productId)))}
    />
  ));

  const newLineFields = (
    label: string,
    placeholder: string,
    value: NewLine,
    setValue: (v: NewLine) => void,
  ) => (
    // Label above the fields rather than under them: a caption below reads as a note about what
    // was just typed instead of as the name of the thing being typed into.
    <Box sx={{ mt: 1, px: ROW_PX, py: 1, borderRadius: 2, border: 1, borderColor: 'divider', borderStyle: 'dashed' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          fullWidth
          placeholder={placeholder}
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
          inputProps={{ 'aria-label': label }}
        />
        <TextField
          size="small"
          type="number"
          placeholder="ks"
          value={value.quantity}
          onChange={(e) => setValue({ ...value, quantity: e.target.value })}
          inputProps={{ min: 0, style: { textAlign: 'right' }, 'aria-label': `${label} — počet` }}
          sx={{ width: ACTUAL_W }}
        />
      </Stack>
    </Box>
  );

  return (
    <FormDrawer
      open={open}
      title="Zaznamenat změnu"
      subtitle={[context.clientName, context.orderLabel].filter(Boolean).join(' · ')}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Uložit změny"
      busy={busy}
      width={680}
    >
      <Stack spacing={2}>
        {/* Guidance, so it reads as a note rather than as the first paragraph of the form. */}
        <Box
          sx={{
            px: 1.75, py: 1.25, borderRadius: 2, border: 1, borderColor: 'divider',
            bgcolor: (t) => t.vars!.palette.brand.infoTint,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Objednávka zůstane plánem — přepisujete jen sloupec{' '}
            <Box component="span" sx={{ fontWeight: 800, color: 'text.primary' }}>Skutečně</Box>.
            {' '}Rozdíl se uloží jako změna vedle objednávky.
          </Typography>
        </Box>

        {hasOrder && (
          <>
            <Divider />
            {/* One table: the order's own lines, then whatever was taken at the door beneath
                them. The operator is reading a single list of what the client ended up with. */}
            {quantityTable('Položky', 'Skutečně', items, setItems, 'ks', { appended: doorSideRows })}
            {added.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1 }}>
                Nula položku navíc odebere.
              </Typography>
            )}

            <Box>
              <SectionLabel>Přidat produkt navíc</SectionLabel>
              {/* The order editor's own catalog, not an imitation of it: the same brewery panels,
                  the same prices, the same +/− control. Panels start closed — expanded, the
                  catalog would bury Vratky and everything under it. */}
              {catalog.isLoading ? (
                <Stack alignItems="center" sx={{ py: 2 }}><CircularProgress size={22} /></Stack>
              ) : (
                <ProductCatalogBrowser
                  breweries={catalog.data?.breweries ?? []}
                  quantities={addedQuantities}
                  onAdd={addProduct}
                  onChange={changeProductQty}
                  exclude={onOrder}
                  colorForBrewery={colorForBrewery}
                  panelsOpenByDefault={false}
                  emptyTitle="Žádné produkty"
                />
              )}
            </Box>

            {(context.goods ?? []).length > 0 && (
              <>
                <Divider />
                {quantityTable('Zboží dodavatele', 'Skutečně', goods, setGoods, 'ks')}
              </>
            )}

            <Divider />
            {/* Rendered even with nothing planned: a client who was to return nothing and hands
                the driver four crates anyway is the ordinary case, not the edge one — and with
                the section hidden there would be nowhere to write it down. */}
            {quantityTable('Vratky', 'Vráceno', returns, setReturns, '×', { isReturn: true })}
            {newLineFields(
              'Přidat vratku, kterou objednávka neplánovala',
              'Např. Basa 0,5 l — prázdná',
              newReturn,
              setNewReturn,
            )}

            <Divider />
            {quantityTable('Položky navíc', 'Předáno', extras, setExtras, 'ks')}
            {newLineFields(
              'Přidat položku předanou na místě',
              'Např. Kelímky 0,5 l',
              newExtra,
              setNewExtra,
            )}
          </>
        )}

        <Divider />
        <Box>
          <SectionLabel>Peníze</SectionLabel>
          <TextField
            size="small"
            fullWidth
            type="number"
            label="Rozdíl v Kč"
            helperText="Plus když klient dluží nám, minus když my jemu."
            value={money}
            onChange={(e) => setMoney(e.target.value)}
            placeholder="např. 2610"
          />
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={2}
            label="Poznámka ke změně"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Co se stalo a co se musí dořešit…"
            sx={{ mt: 1.5 }}
          />
        </Box>

        {addressEntry && (
          <>
            <Divider />
            <Box>
              <SectionLabel>Adresa</SectionLabel>
              <TextDiff before={addressEntry.plannedText} after={addressEntry.actualText} />
              <Typography variant="caption" color="text.secondary">
                Zapsáno automaticky při změně adresy pod jedoucím vývozem.
              </Typography>
            </Box>
          </>
        )}
      </Stack>
    </FormDrawer>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{ display: 'block', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.75 }}
    >
      {children}
    </Typography>
  );
}

/** Column widths, shared by the heads and the rows so the two line up. */
const PLAN_W = 64;
const ACTUAL_W = 92;

/** Row padding, which the heads have to repeat or the labels sit off their columns. */
const ROW_PX = 1.25;

function ColumnHeads({ actualLabel }: { actualLabel: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ px: ROW_PX }}>
      <Box sx={{ flex: 1 }} />
      <Typography variant="caption" color="text.secondary" sx={{ width: PLAN_W, textAlign: 'right' }}>
        Plán
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ width: ACTUAL_W, textAlign: 'right' }}>
        {actualLabel}
      </Typography>
    </Stack>
  );
}

/**
 * One line of the form: what was planned, and the number being typed over it.
 *
 * Bordered like the catalog's own rows, because a bare row of a name and two numbers at opposite
 * edges of a 680px drawer reads as three unrelated things. A row that no longer matches its plan
 * carries the amber the rest of the app gives a deviation, so what has been typed is visible
 * without reading every number back.
 */
function QuantityRow({
  name, chip, planned, value, inputLabel, tone, tag, onValue, onRemove,
}: {
  name: string;
  chip?: string;
  /** Rendered as text, unit included; omitted for a row the order never planned. */
  planned?: string;
  value: string;
  inputLabel: string;
  /** Absent while the row still matches its plan. */
  tone?: LedgerTone;
  /** Words for the tone, because colour must never be the only signal. */
  tag?: string;
  onValue: (value: string) => void;
  onRemove?: () => void;
}) {
  const color = tone ? TONE_COLOR[tone] : undefined;

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      data-changed={tone ? 'true' : 'false'}
      data-tone={tone ?? 'none'}
      sx={{
        px: ROW_PX,
        py: 0.75,
        border: 1,
        borderRadius: 2,
        borderColor: color ? color.fg : 'divider',
        bgcolor: (t) => (color ? t.vars!.palette.brand[color.bg] : 'transparent'),
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap>{name}</Typography>
          {tone && tag && <LedgerTag tone={tone} label={tag} />}
        </Stack>
        {chip && <Typography variant="caption" color="text.secondary" noWrap>{chip}</Typography>}
      </Box>
      <Typography
        sx={{
          width: PLAN_W, textAlign: 'right', fontSize: 13,
          color: 'text.secondary', fontVariantNumeric: 'tabular-nums',
        }}
      >
        {planned ?? '—'}
      </Typography>
      <TextField
        size="small"
        type="number"
        value={value}
        onChange={(e) => onValue(e.target.value)}
        inputProps={{ min: 0, style: { textAlign: 'right' }, 'aria-label': inputLabel }}
        sx={{ width: ACTUAL_W }}
      />
      {onRemove && (
        <Tooltip title="Odebrat">
          <IconButton size="small" aria-label={`Odebrat ${name}`} onClick={onRemove} sx={{ color: 'text.disabled' }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}
