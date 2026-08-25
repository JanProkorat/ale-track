// The two constraints the inline diff has to keep, both of which fail silently:
//
//   1. Colour is never the only signal. A colour-blind reader and a printed copy get nothing but
//      the tag's words, so every changed row carries them.
//   2. Colours come through theme.vars.palette.*. Under MUI cssVars, reading theme.palette.*
//      inside an sx callback freezes the light value — dark mode then renders white borders on a
//      dark card, and nothing about it fails to compile.

import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { afterEach, describe, expect, it } from 'vitest';
import { ClientLedgerEntryDto, ClientLedgerEntryTarget } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { LedgerRowTag, QuantityDiff, TextDiff } from './LedgerDiff';
import { applyLedger, type DecoratedRow } from './ledgerModel';

const ITEM = '11111111-1111-1111-1111-111111111111';

function entry(over: Partial<ClientLedgerEntryDto> = {}): ClientLedgerEntryDto {
  return ClientLedgerEntryDto.fromJS({
    id: `e-${Math.random()}`,
    target: ClientLedgerEntryTarget.ProductQuantity,
    requiresFollowUp: false,
    createdAt: '2026-08-24T10:00:00Z',
    ...over,
  });
}

/** One decorated row per state, built through applyLedger so the states are the real ones. */
const ROWS: Record<string, DecoratedRow> = {
  unchanged: applyLedger([{ key: ITEM, name: 'Ležák 12', quantity: 10 }], [])[0],
  changed: applyLedger(
    [{ key: ITEM, name: 'Ležák 12', quantity: 10 }],
    [entry({ orderItemId: ITEM, plannedQuantity: 10, actualQuantity: 7 })],
  )[0],
  removed: applyLedger(
    [{ key: ITEM, name: 'Ležák 12', quantity: 10 }],
    [entry({ orderItemId: ITEM, plannedQuantity: 10, actualQuantity: 0 })],
  )[0],
  added: applyLedger(
    [],
    [entry({ productId: 'p-9', productName: 'Světlé 10', plannedQuantity: 0, actualQuantity: 4 })],
  )[0],
};

/** Renders in the viewer's scheme, which MUI reads off the root element. */
function renderIn(scheme: 'light' | 'dark', ui: React.ReactNode) {
  document.documentElement.setAttribute('data-theme', scheme);
  return render(<MuiThemeProvider theme={theme}>{ui}</MuiThemeProvider>);
}

afterEach(() => document.documentElement.removeAttribute('data-theme'));

describe.each(['light', 'dark'] as const)('the inline diff in %s mode', (scheme) => {
  it('renders an unchanged row as one plain number', () => {
    renderIn(scheme, <QuantityDiff row={ROWS.unchanged} />);

    expect(screen.getByText('10 ks')).toBeInTheDocument();
  });

  it('renders a changed row as both numbers', () => {
    renderIn(scheme, <QuantityDiff row={ROWS.changed} />);

    expect(screen.getByText('10 ks')).toBeInTheDocument();
    expect(screen.getByText('7 ks')).toBeInTheDocument();
  });

  it('renders a removed row as both numbers', () => {
    renderIn(scheme, <QuantityDiff row={ROWS.removed} />);

    expect(screen.getByText('10 ks')).toBeInTheDocument();
    expect(screen.getByText('0 ks')).toBeInTheDocument();
  });

  // Nothing was planned, so there is no old value to strike — a struck-through zero would read
  // as an error rather than as "this was never ordered".
  it('renders an added row as what arrived alone', () => {
    renderIn(scheme, <QuantityDiff row={ROWS.added} />);

    expect(screen.getByText('4 ks')).toBeInTheDocument();
    expect(screen.queryByText('0 ks')).not.toBeInTheDocument();
  });

  it('words every changed state', () => {
    renderIn(scheme, (
      <>
        <LedgerRowTag row={ROWS.changed} />
        <LedgerRowTag row={ROWS.removed} />
        <LedgerRowTag row={ROWS.added} />
      </>
    ));

    expect(screen.getByText('Nevyloženo 3 ks')).toBeInTheDocument();
    expect(screen.getByText('Nevyloženo')).toBeInTheDocument();
    expect(screen.getByText('Přidáno na místě')).toBeInTheDocument();
  });

  it('says nothing at all about an unchanged row', () => {
    const { container } = renderIn(scheme, <LedgerRowTag row={ROWS.unchanged} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the address diff both ways round', () => {
    renderIn(scheme, <TextDiff before="Dlouhá 1" after="Krátká 2" />);

    expect(screen.getByText('Dlouhá 1')).toBeInTheDocument();
    expect(screen.getByText('Krátká 2')).toBeInTheDocument();
  });

  it('renders a dash where an address is missing', () => {
    renderIn(scheme, <TextDiff before={undefined} after="Krátká 2" />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

// happy-dom does not resolve CSS variables scoped by an attribute selector, so the dark palette
// cannot be asserted through computed styles. What can be asserted is the rule whose breach
// causes the bug: a colour read from theme.palette.* inside a callback is frozen at the light
// value, and only dark mode ever shows it.
describe('the ledger UI reads colours scheme-aware', () => {
  const FILES = [
    'LedgerDiff.tsx',
    'ledgerStyles.ts',
    'LedgerMoneyCard.tsx',
    'LedgerPanel.tsx',
    'ClientOpenItemsCard.tsx',
    'ClientOpenItemsPreview.tsx',
    'LedgerEntryDrawer.tsx',
  ];

  it.each(FILES)('%s never reads theme.palette.* in a callback', (file) => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');

    // `theme.vars.palette` and the `t.vars!.palette` shorthand are the correct forms; a bare
    // `.palette.` off the theme object is the defect. Comments are skipped — several of these
    // files state the rule in prose, and the guard must not trip over the rule being written
    // down.
    const offenders = source
      .split('\n')
      .map((line, i) => ({ line: line.trim(), at: i + 1 }))
      .filter(({ line }) => !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'))
      .filter(({ line }) => /\b(?:theme|t)\.palette\./.test(line));

    expect(offenders).toEqual([]);
  });
});
