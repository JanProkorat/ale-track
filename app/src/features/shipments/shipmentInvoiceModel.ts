// Pure shaping of the invoice-split response for the Fakturace section.
//
// Kept out of the component so the parts that actually carry risk — merging rows
// per product while keeping the per-source breakdown, deriving cross-billing, and
// ordering client bands — can be tested without a rendering harness.

import type {
  OrderNoteDto,
  OrderReturnDto,
  OutgoingShipmentStopDto,
  ShipmentInvoiceDto,
  ShipmentInvoiceLineDto,
  ShipmentInvoicesDto,
  InvoiceLineSourceKind,
  ProductKind,
} from 'src/generated/api-client';
import { resolveDetailStopAddress } from './stopAddress';

/** One product on one invoice, with the exact per-source breakdown behind it. */
export interface LineGroup {
  productKey: string;
  name: string;
  /** What the pieces are: a brewery product, a supplier good, a free-text extra. Taken off the
   *  first part — the key groups by product or by name, so a group is of one kind. */
  sourceKind?: InvoiceLineSourceKind;
  kind?: ProductKind;
  packageSize?: number;
  priceWithVat?: number;
  quantity: number;
  /** Underlying lines, one per source item. A move operates on exactly one of these. */
  parts: ShipmentInvoiceLineDto[];
}

/** A client and all their invoices on this shipment. */
export interface ClientBand {
  clientId: string;
  clientName: string;
  stopOrder?: number;
  invoices: ShipmentInvoiceDto[];
  /** Billed pieces only — private ones are counted separately. */
  quantity: number;
  value: number;
  crossBilled: number;
  /** Pieces this client ordered that are excluded from every invoice. */
  privateLines: ShipmentInvoiceLineDto[];
  privateQuantity: number;
}

/** Move target standing for "no invoice at all". */
export const PRIVATE_TARGET = 'private';

/**
 * Collapse an invoice's lines to one row per product.
 *
 * The same product can reach one invoice from several sources at once — the client's
 * own order, another client's order, our stock. Those merge into a single row, but
 * `parts` keeps them separate: a move has to name which source its pieces come off,
 * and its cap follows that source rather than the row total.
 */
export function groupLines(invoice: ShipmentInvoiceDto): LineGroup[] {
  return groupLineList(invoice.lines ?? []);
}

/**
 * The same merging for a bare list of lines — the private pieces of one client, which
 * belong to no invoice but are shown as product rows just the same.
 */
export function groupLineList(lines: ShipmentInvoiceLineDto[]): LineGroup[] {
  const map = new Map<string, LineGroup>();
  const order: string[] = [];
  for (const line of lines) {
    // Custom extras and supplier goods have no product, so they group by name instead.
    const key = line.productId ?? `name:${line.name}`;
    let group = map.get(key);
    if (!group) {
      group = {
        productKey: key,
        name: line.name ?? '—',
        sourceKind: line.sourceKind,
        kind: line.kind,
        packageSize: line.packageSize,
        priceWithVat: line.priceWithVat,
        quantity: 0,
        parts: [],
      };
      map.set(key, group);
      order.push(key);
    }
    group.quantity += line.quantity ?? 0;
    group.parts.push(line);
  }
  return order.map((k) => map.get(k)!);
}

export function groupValue(group: LineGroup): number {
  return (group.priceWithVat ?? 0) * group.quantity;
}

export function invoiceQuantity(invoice: ShipmentInvoiceDto): number {
  return (invoice.lines ?? []).reduce((s, l) => s + (l.quantity ?? 0), 0);
}

export function invoiceValue(invoice: ShipmentInvoiceDto): number {
  return (invoice.lines ?? []).reduce((s, l) => s + (l.priceWithVat ?? 0) * (l.quantity ?? 0), 0);
}

/**
 * A line is cross-billed when whoever ordered the pieces is not who gets the invoice.
 * Private pieces (no invoice) never are — nobody is being billed for them.
 */
export function isCrossBilled(
  invoice: ShipmentInvoiceDto | null,
  line: ShipmentInvoiceLineDto,
): boolean {
  if (!invoice) return false;
  return Boolean(line.orderingClientId) && line.orderingClientId !== invoice.clientId;
}

/**
 * Group invoices into client bands, in route order. Clients without a stop — they only
 * hold cross-billed lines after their own order left the shipment — sort last.
 *
 * Private pieces join the band of whoever ordered them, not of whoever would have been
 * billed: there is no invoice to belong to, and the order is what the office recognises
 * them by.
 */
export function toBands(data: ShipmentInvoicesDto): ClientBand[] {
  const map = new Map<string, ClientBand>();

  const bandFor = (clientId: string, clientName: string, stopOrder?: number) => {
    let band = map.get(clientId);
    if (!band) {
      band = {
        clientId,
        clientName,
        stopOrder,
        invoices: [],
        quantity: 0,
        value: 0,
        crossBilled: 0,
        privateLines: [],
        privateQuantity: 0,
      };
      map.set(clientId, band);
    }
    return band;
  };

  for (const invoice of data.invoices ?? []) {
    const band = bandFor(invoice.clientId ?? '', invoice.clientName ?? '—', invoice.stopOrder);
    band.invoices.push(invoice);
    band.quantity += invoiceQuantity(invoice);
    band.value += invoiceValue(invoice);
    band.crossBilled += (invoice.lines ?? []).filter((l) => isCrossBilled(invoice, l)).length;
  }

  for (const line of data.privateLines ?? []) {
    // A client can hold private pieces and no invoice at all — every piece they ordered
    // was excluded — so the band may have to be created here.
    const band = bandFor(line.orderingClientId ?? '', line.orderingClientName ?? '—');
    band.privateLines.push(line);
    band.privateQuantity += line.quantity ?? 0;
  }

  const bands = [...map.values()];
  for (const band of bands) band.invoices.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  return bands.sort(
    (a, b) => (a.stopOrder ?? Number.MAX_SAFE_INTEGER) - (b.stopOrder ?? Number.MAX_SAFE_INTEGER),
  );
}

/** Where one part's pieces came from, in the wording the move dialog uses. */
export function partOrigin(
  invoice: ShipmentInvoiceDto | null,
  line: ShipmentInvoiceLineDto,
): string {
  if (line.isFromStock) return 'ze skladu';
  if (isCrossBilled(invoice, line)) return `z obj. ${line.orderingClientName ?? '—'}`;
  return 'z vlastní objednávky';
}

/** Provenance chips for one merged row. */
export interface OriginChips {
  /** Pieces sourced from our own warehouse rather than the brewery. */
  stockQuantity: number;
  /** Cross-billed pieces, keyed by whoever ordered them. */
  foreign: { clientName: string; quantity: number }[];
}

export function originChips(invoice: ShipmentInvoiceDto | null, group: LineGroup): OriginChips {
  const stockQuantity = group.parts
    .filter((p) => p.isFromStock)
    .reduce((s, p) => s + (p.quantity ?? 0), 0);

  const byClient = new Map<string, number>();
  for (const part of group.parts) {
    if (part.isFromStock || !isCrossBilled(invoice, part)) continue;
    const key = part.orderingClientName ?? '—';
    byClient.set(key, (byClient.get(key) ?? 0) + (part.quantity ?? 0));
  }

  return {
    stockQuantity,
    foreign: [...byClient].map(([clientName, quantity]) => ({ clientName, quantity })),
  };
}

/** Parts of a merged row, biggest first, so the move dialog preselects the likeliest. */
export function partsByLikelihood(group: LineGroup): ShipmentInvoiceLineDto[] {
  return [...group.parts].sort((a, b) => (b.quantity ?? 0) - (a.quantity ?? 0));
}

export interface MoveTargetOption {
  value: string;
  label: string;
  group: string;
}

/**
 * Targets for a move: every other invoice on the shipment, grouped per client, plus a
 * fresh invoice for each. Clients who ordered any of the pieces are marked, so billing
 * someone else is a visible choice rather than an accident.
 *
 * A `null` origin means the pieces are already private, so every invoice is a target and
 * "keep them private" is not offered. Otherwise the last option excludes them from
 * invoicing altogether.
 */
export function moveTargetOptions(
  data: ShipmentInvoicesDto,
  fromInvoice: ShipmentInvoiceDto | null,
  group: LineGroup,
): MoveTargetOption[] {
  const byClient = new Map<string, ShipmentInvoiceDto[]>();
  for (const invoice of data.invoices ?? []) {
    const id = invoice.clientId ?? '';
    const list = byClient.get(id) ?? [];
    list.push(invoice);
    byClient.set(id, list);
  }

  const out: MoveTargetOption[] = [];
  for (const [clientId, invoices] of byClient) {
    const sorted = [...invoices].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    const clientName = sorted[0]?.clientName ?? '—';
    const isOrderer = group.parts.some((p) => p.orderingClientId === clientId);
    const groupLabel = `${clientName}${isOrderer ? ' — objednavatel' : ''}`;

    for (const invoice of sorted) {
      if (fromInvoice && invoice.id === fromInvoice.id) continue;
      out.push({
        value: `inv:${invoice.id}`,
        label: `Faktura ${invoice.sequence} — ${invoiceQuantity(invoice)} ks`,
        group: groupLabel,
      });
    }

    const nextSequence = Math.max(...sorted.map((i) => i.sequence ?? 0)) + 1;
    out.push({ value: `new:${clientId}`, label: `+ nová faktura ${nextSequence}`, group: groupLabel });
  }

  if (fromInvoice) {
    out.push({
      value: PRIVATE_TARGET,
      label: 'Soukromé (nefakturovat)',
      group: 'Mimo fakturaci',
    });
  }
  return out;
}

/** The shipment stop a Fakturace band belongs to.
 *
 * The invoice split comes from its own endpoint, which knows the client but
 * nothing about the route, so anything stop-shaped has to be matched back to
 * the shipment's own stops. `stopOrder` is the match key rather than
 * `clientId`: one client can hold two stops on a route, and picking the wrong
 * one would attribute a destination or a note to the wrong delivery.
 * `clientId` is only a fallback for a band whose invoices carry no stop order.
 *
 * Returns undefined when nothing matches. The two datasets are separate
 * queries and can briefly disagree — after a stop is removed but before the
 * invoice query refetches, say — and on an invoicing screen showing nothing
 * beats showing something confidently wrong.
 */
function stopForBand(
  band: ClientBand,
  stops: OutgoingShipmentStopDto[],
): OutgoingShipmentStopDto | undefined {
  return band.stopOrder != null
    ? stops.find((s) => s.order === band.stopOrder)
    : stops.find((s) => s.clientId === band.clientId);
}

/** Where a band's goods are actually delivered, for the Fakturace header.
 *
 * The driver's note on a delivery place is deliberately not returned: it routes
 * a van through a gate, and means nothing to the office doing the billing. The
 * order's own notes are a different thing — see {@link bandNotes}.
 */
export function bandAddress(
  band: ClientBand,
  stops: OutgoingShipmentStopDto[],
): { text: string; placeName?: string } | undefined {
  const stop = stopForBand(band, stops);
  if (!stop) return undefined;

  const resolved = resolveDetailStopAddress(stop);
  return {
    text: resolved.text,
    placeName: resolved.isPlace ? stop.deliveryPlace?.name : undefined,
  };
}

/** The notes on the order behind a band, oldest first as the backend sends them.
 *
 * Empty for a custom stop, for an order with no notes, and for a band with no
 * matching stop — all three render nothing rather than an empty container. */
export function bandNotes(
  band: ClientBand,
  stops: OutgoingShipmentStopDto[],
): OrderNoteDto[] {
  return stopForBand(band, stops)?.notes ?? [];
}

/** The vratky the client hands back against the order behind a band.
 *
 * Same emptiness rules as {@link bandNotes}. Returns are owned by the order and
 * only displayed here, exactly as on the shipment's own Vratky card. */
export function bandReturns(
  band: ClientBand,
  stops: OutgoingShipmentStopDto[],
): OrderReturnDto[] {
  return stopForBand(band, stops)?.returns ?? [];
}

/** Totals for the section header. */
export function sectionTotals(data: ShipmentInvoicesDto, bands: ClientBand[]) {
  return {
    invoices: data.invoices?.length ?? 0,
    clients: bands.length,
    quantity: bands.reduce((s, b) => s + b.quantity, 0),
    value: bands.reduce((s, b) => s + b.value, 0),
    crossBilled: bands.reduce((s, b) => s + b.crossBilled, 0),
    privateQuantity: bands.reduce((s, b) => s + b.privateQuantity, 0),
  };
}
