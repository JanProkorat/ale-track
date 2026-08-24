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
import { Box, Divider, Stack, TextField, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { Combobox } from 'src/components/common/Combobox';
import { apiErrorMessage } from 'src/api/errors';
import { fmtLiters } from 'src/lib/format';
import { kindLabel } from 'src/lib/labels';
import {
  ClientLedgerEntryTarget,
  SaveClientLedgerEntriesDto,
  UpdateClientLedgerEntryDto,
  type ClientLedgerRowDto,
  type ClientLedgerEntryDto,
} from 'src/generated/api-client';
import { useProducts } from 'src/hooks/useProducts';
import {
  useDeleteClientLedgerEntry,
  useSaveClientLedgerEntries,
  useUpdateClientLedgerEntry,
} from 'src/hooks/useClientLedger';
import {
  deliveredEntryFor,
  entriesForTarget,
  isFreeEntry,
  type PlanRow,
} from './ledgerModel';
import { TextDiff } from './LedgerDiff';

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
  const products = useProducts();

  // Memoised: the fallback array is a fresh value on every render, which would make the two
  // lookups below recompute each time.
  const entries = useMemo(() => context.entries ?? [], [context.entries]);
  const hasOrder = Boolean(context.orderId);

  const [items, setItems] = useState<EditableRow[]>([]);
  const [goods, setGoods] = useState<EditableRow[]>([]);
  const [returns, setReturns] = useState<EditableRow[]>([]);
  const [extras, setExtras] = useState<EditableRow[]>([]);
  const [newProduct, setNewProduct] = useState<string | null>(null);
  const [newProductQty, setNewProductQty] = useState('');
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
    setNewProduct(null);
    setNewProductQty('');
    setNewReturn(EMPTY_NEW_LINE);
    setNewExtra(EMPTY_NEW_LINE);
    setMoney(moneyEntry?.amount != null ? String(moneyEntry.amount) : '');
    setNote(moneyEntry?.note ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, context.orderId, context.clientId]);

  const productOptions = useMemo(() => {
    const onOrder = new Set((context.items ?? []).map((r) => r.key));
    return (products.data ?? [])
      .filter((p) => p.id && !onOrder.has(p.id))
      .map((p) => ({
        value: p.id!,
        label: p.name ?? '—',
        secondary: [kindLabel(p.kind), p.packageSize != null ? fmtLiters(p.packageSize) : '']
          .filter(Boolean).join(' · '),
      }));
  }, [products.data, context.items]);

  const busy = save.isPending || updateEntry.isPending || deleteEntry.isPending;

  /**
   * Builds the batch. Every planned line goes in, unchanged ones included: the server deletes a
   * stored deviation when it is told the line is back at its planned value, so leaving those out
   * would strand a correction the operator just undid.
   */
  const buildRows = (): ClientLedgerRowDto[] => {
    const rows: ClientLedgerRowDto[] = [];

    const push = (row: Partial<ClientLedgerRowDto>) => rows.push(row as ClientLedgerRowDto);

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

    // Nothing planned it, so it is keyed by what it is rather than by a line of the order.
    const productQty = parsed(newProductQty, 0);
    if (newProduct && productQty > 0) {
      push({
        target: ClientLedgerEntryTarget.ProductQuantity,
        productId: newProduct,
        plannedQuantity: 0,
        actualQuantity: productQty,
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
  ) => (
    <Box>
      <SectionLabel>{title}</SectionLabel>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ pb: 1 }}>
          Objednávka žádné neplánovala.
        </Typography>
      ) : (
        <Stack spacing={1}>
          <Stack direction="row" spacing={1}>
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ width: 56, textAlign: 'right' }}>
              Plán
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ width: 96, textAlign: 'right' }}>
              {actualLabel}
            </Typography>
          </Stack>
          {rows.map((row, index) => (
            <Stack key={row.key} direction="row" spacing={1} alignItems="center">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{row.name}</Typography>
                {row.chip && (
                  <Typography variant="caption" color="text.secondary">{row.chip}</Typography>
                )}
              </Box>
              <Typography
                sx={{ width: 56, textAlign: 'right', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
              >
                {row.quantity} {unit}
              </Typography>
              <TextField
                size="small"
                type="number"
                value={row.actual}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, actual: e.target.value };
                  setRows(next);
                }}
                inputProps={{ min: 0, style: { textAlign: 'right' }, 'aria-label': `${row.name} — ${actualLabel}` }}
                sx={{ width: 96 }}
              />
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );

  const newLineFields = (
    label: string,
    placeholder: string,
    value: NewLine,
    setValue: (v: NewLine) => void,
  ) => (
    <Box sx={{ mt: 1 }}>
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
          sx={{ width: 96 }}
        />
      </Stack>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
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
      width={520}
    >
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Objednávka zůstane plánem — přepisujete jen sloupec{' '}
          <Box component="span" sx={{ fontWeight: 800 }}>Skutečně</Box>. Rozdíl se uloží jako
          změna vedle objednávky.
        </Typography>

        {hasOrder && (
          <>
            <Divider />
            {quantityTable('Položky', 'Skutečně', items, setItems, 'ks')}

            <Box>
              <SectionLabel>Přidat produkt vzatý na místě</SectionLabel>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Box sx={{ flex: 1 }}>
                  <Combobox
                    value={newProduct}
                    onChange={setNewProduct}
                    options={productOptions}
                    placeholder="— vyberte —"
                  />
                </Box>
                <TextField
                  size="small"
                  type="number"
                  placeholder="ks"
                  value={newProductQty}
                  onChange={(e) => setNewProductQty(e.target.value)}
                  inputProps={{ min: 0, style: { textAlign: 'right' }, 'aria-label': 'Počet vzatých na místě' }}
                  sx={{ width: 96 }}
                />
              </Stack>
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
            {quantityTable('Vratky', 'Vráceno', returns, setReturns, '×')}
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
            label="Rozdíl v Kč — plus když klient dluží nám, minus když my jemu"
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
