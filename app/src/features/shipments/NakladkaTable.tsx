// The nakládka ("Rozpis zboží") table.
//
// A CSS grid, not a <table>, and one layout rather than a table plus a stacked
// fallback. What replaced the fork: the old table gave every brewery invoice its own
// ~112px column pair, so the column count grew with the data until nothing fit and the
// whole thing dropped to a per-row list of wrapped micro-labels. Here the invoice split
// lives inside one cell as self-labelling chips, so a third or fourth invoice costs a
// line rather than a column, and the same markup serves every width.
//
// Widths are decided by the card's own width through container queries, never the
// viewport's. The card is 1.5fr of a 1.5fr/1fr page grid, which leaves it ~521px on an
// iPad in landscape and ~625px in a 1373px window — a viewport breakpoint reads those
// as roomy and is wrong every time.

import { Fragment, useState, type ReactNode } from 'react';
import { Box, ButtonBase, Collapse, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined';
import { useBreweryColors } from 'src/hooks/useBreweries';
import { plural } from 'src/lib/format';
import { StepperButton, stepperTracks, type StepperAdjust } from './nakladkaControls';
import type { BrewerySection } from './nakladkaGrouping';

/** What the table itself reads off a row; everything else goes through the renderers.
 *  The plato/size chip is derived rather than stored, so it arrives via `chipOf`. */
export interface NakladkaRowShape {
  key: string;
  name: string;
  quantity: number;
}

const SECTION_MOTION_MS = 180;

/**
 * The four tracks, and the whole reason the numbers line up.
 *
 * Sized rather than content-derived: every row is its own grid container — a section has
 * to sit in its own box for `Collapse` to animate its height — so `max-content` would
 * measure each row separately and no two would agree. Zdroj and Faktury carry the same
 * floor and share the slack evenly with Produkt, so they end up exactly as wide as each
 * other instead of huddling at the right edge while Produkt swallows everything spare.
 */
const COLS = 'minmax(120px, 1fr) 54px minmax(176px, 1fr) minmax(176px, 1fr)';

/** Ks loses its column here: at 521px the four tracks leave the name 79px and truncate
 *  it mid-word, and no amount of gap tightening recovers 60px. It rejoins the product
 *  cell beside the chip; Zdroj and Faktury keep theirs, which is the alignment that
 *  earns its keep. */
const COLS_NO_KS = 'minmax(120px, 1fr) minmax(176px, 1fr) minmax(176px, 1fr)';

const GRID_SX = {
  display: 'grid',
  gridTemplateColumns: COLS,
  alignItems: 'center',
  columnGap: 1.75,
  px: 2,
  // Tighter where the card is narrow — the cheapest width there is to find.
  '@container nakladka (max-width: 700px)': { columnGap: 1.25, px: 1.5 },
  '@container nakladka (max-width: 580px)': { gridTemplateColumns: COLS_NO_KS },
} as const;

export function NakladkaTable<T extends NakladkaRowShape>({
  sections, totalQuantity, emptyText, footer, chipOf, renderSource, renderInvoices,
}: {
  sections: BrewerySection<T>[];
  totalQuantity: number;
  emptyText: string;
  /** Per-invoice totals and loading progress for the summary bar. */
  footer: ReactNode;
  /** "11° · 50 l", where the product has one. */
  chipOf?: (row: T) => string | undefined;
  renderSource: (row: T) => ReactNode;
  renderInvoices: (row: T) => ReactNode;
}) {
  const colorForBrewery = useBreweryColors();
  // Collapsed rather than expanded ids, so every brewery starts open: the list is worked
  // through, and a run that arrives folded costs a tap per brewery before any of it can
  // be read out. Survives the invoice filter, but not a different shipment — the screen
  // is remounted for those.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>());

  function toggleBrewery(breweryId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(breweryId)) next.add(breweryId);
      return next;
    });
  }

  if (sections.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ fontSize: 13, py: 2, px: { xs: 1.25, compact: 2.5 } }}>
        {emptyText}
      </Typography>
    );
  }

  return (
    // The container the queries above resolve against. Named so a query cannot
    // accidentally bind to some other ancestor that happens to be a container.
    //
    // Flush inside the card that heads it rather than a card of its own: the tiers below
    // are keyed on the card's width — 521px on an iPad, 625px in a 1373px window — and a
    // border with 20px of padding each side would leave the queries measuring 42px less
    // than the width they were chosen for, one whole tier out at exactly the size this
    // card is on a tablet.
    <Box sx={{ containerType: 'inline-size', containerName: 'nakladka' }}>
      <Box
        sx={{
          ...GRID_SX,
          py: 1.25,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: (t) => t.vars!.palette.brand.surface2,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'text.secondary',
          // No header on a phone: the clusters name themselves, which is what lets the
          // same markup drop to one column without becoming unreadable.
          '@container nakladka (max-width: 500px)': { display: 'none' },
        }}
      >
        <Box component="span">Produkt</Box>
        <Box
          component="span"
          sx={{ textAlign: 'right', '@container nakladka (max-width: 580px)': { display: 'none' } }}
        >
          Ks
        </Box>
        <Box component="span">Zdroj</Box>
        <Box component="span">Faktury</Box>
      </Box>

      {sections.map((brewery) => (
        <Fragment key={brewery.breweryId}>
          <BreweryHeading
            label={brewery.label}
            count={brewery.rows.length}
            color={colorForBrewery(brewery.breweryId)}
            open={!collapsed.has(brewery.breweryId)}
            onToggle={() => toggleBrewery(brewery.breweryId)}
          />
          <Collapse in={!collapsed.has(brewery.breweryId)} timeout={SECTION_MOTION_MS} unmountOnExit>
            {brewery.kinds.map((section) => (
              <Fragment key={section.kind}>
                <Box
                  sx={{
                    pl: 3.75, pr: 2, py: 0.75, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'text.secondary',
                    bgcolor: (t) => t.vars!.palette.brand.surface3,
                    borderBottom: 1, borderColor: 'divider',
                  }}
                >
                  {section.label}
                  <Box component="span" sx={{ ml: 1, fontWeight: 500, textTransform: 'none', letterSpacing: 0, opacity: 0.8 }}>
                    · {section.rows.length} {plural(section.rows.length, 'položka', 'položky', 'položek')}
                  </Box>
                </Box>
                {section.rows.map((row) => (
                  <NakladkaTableRow
                    key={row.key}
                    row={row}
                    chip={chipOf?.(row)}
                    source={renderSource(row)}
                    invoices={renderInvoices(row)}
                  />
                ))}
              </Fragment>
            ))}
          </Collapse>
        </Fragment>
      ))}

      {/* Its own tracks rather than GRID_SX: the footer has a label, a total and the
          progress pills, which is not the row's four things, and reusing the row's tracks
          left the pills stranded in the Zdroj column. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'center',
          columnGap: 1.75,
          rowGap: 1,
          px: 2,
          py: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: (t) => t.vars!.palette.brand.surface2,
          '@container nakladka (max-width: 700px)': { px: 1.5, columnGap: 1.25 },
          '@container nakladka (max-width: 500px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Celkem k naložení</Typography>
          <Total quantity={totalQuantity} />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>{footer}</Box>
      </Box>
    </Box>
  );
}

/** The row total. Its own component because the phone layout has to line the number up
 *  with the ones below it, which needs the unit in a box of its own. */
function Total({ quantity, sx }: { quantity: number; sx?: object }) {
  return (
    <Box
      sx={{
        textAlign: 'right', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        ...sx,
      }}
    >
      {/* Right-aligning "33 ks" as one string puts the unit where the number belongs and
          pushes the number off the axis, by however wide the unit happens to render. So
          the number takes the value column's own 22px box and the unit takes a box exactly
          as wide as the gap plus the + button (6 + 28) that follow it. */}
      <Box component="span" sx={{ display: 'inline-block', minWidth: 22, textAlign: 'center' }}>
        {quantity}
      </Box>
      <Box
        component="span"
        sx={{
          fontSize: 11.5, fontWeight: 600, color: 'text.secondary', ml: 0.5,
          '@container nakladka (max-width: 500px)': {
            display: 'inline-block', width: 34, ml: 0, textAlign: 'left',
          },
        }}
      >
        ks
      </Box>
    </Box>
  );
}

function NakladkaTableRow<T extends NakladkaRowShape>({
  row, chip, source, invoices,
}: {
  row: T;
  chip?: string;
  source: ReactNode;
  invoices: ReactNode;
}) {
  return (
    <Box
      data-testid="nakladka-row"
      sx={{
        ...GRID_SX,
        py: 1.25,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
        // Name and total on the first line, the two clusters side by side under it:
        // Faktury left, Zdroj right beneath the total. Stacking them full width instead
        // made every row four blocks tall.
        '@container nakladka (max-width: 500px)': {
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gridTemplateAreas: '"head head" "invoices source"',
          rowGap: 1.25,
          alignItems: 'start',
          px: 1.5,
        },
      }}
    >
      <Box
        sx={{
          minWidth: 0,
          // Below 580 the name owns the first line and the chip shares the next one with
          // the total. `display: contents` hands both up to the row's grid so the total
          // can sit beside the chip instead of dangling on a third line of its own.
          '@container nakladka (max-width: 580px)': {
            display: 'grid',
            gridTemplateColumns: 'auto auto',
            gridTemplateAreas: '"name name" "chip total"',
            justifyContent: 'start',
            alignItems: 'center',
            columnGap: 1,
            rowGap: 0.4,
          },
          // On a phone the total comes back up beside the name and the chip keeps the
          // line below it to itself: name and chip on one line with the total behind
          // them fits this row's names and not the next one's.
          '@container nakladka (max-width: 500px)': {
            gridArea: 'head',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gridTemplateAreas: '"name total" "chip ."',
            columnGap: 1.25,
            alignItems: 'baseline',
          },
        }}
      >
        <Typography
          sx={{
            gridArea: 'name', fontWeight: 700, fontSize: 13.5,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {row.name}
        </Typography>
        {chip && (
          <Box
            component="span"
            sx={{
              gridArea: 'chip', justifySelf: 'start',
              px: 1.125, py: 0.25, borderRadius: 999, fontSize: 11.5, fontWeight: 700,
              bgcolor: (t) => t.vars!.palette.brand.surface3,
              color: 'text.secondary', whiteSpace: 'nowrap',
            }}
          >
            {chip}
          </Box>
        )}
        {/* Only rendered into the product cell where Ks has no column of its own. */}
        <Total
          quantity={row.quantity}
          sx={{
            gridArea: 'total', display: 'none',
            '@container nakladka (max-width: 580px)': { display: 'block', textAlign: 'left' },
            '@container nakladka (max-width: 500px)': { justifySelf: 'end', textAlign: 'right' },
          }}
        />
      </Box>

      <Total
        quantity={row.quantity}
        sx={{ '@container nakladka (max-width: 580px)': { display: 'none' } }}
      />

      <Box sx={{ minWidth: 0, '@container nakladka (max-width: 500px)': { gridArea: 'source' } }}>
        {source}
      </Box>
      <Box sx={{ minWidth: 0, '@container nakladka (max-width: 500px)': { gridArea: 'invoices' } }}>
        {invoices}
      </Box>
    </Box>
  );
}

function BreweryHeading({
  label, count, color, open, onToggle,
}: {
  label: string;
  count: number;
  color?: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <ButtonBase
      onClick={onToggle}
      aria-expanded={open}
      // Names the action, not the state: "Sbalit Pivovar Svijany" tells a screen reader
      // what the press will do, which aria-expanded alone does not.
      aria-label={`${open ? 'Sbalit' : 'Rozbalit'} ${label}`}
      sx={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25,
        justifyContent: 'flex-start', textAlign: 'left',
        borderTop: 1, borderBottom: 1, borderColor: 'divider',
        bgcolor: (t) => t.vars!.palette.brand.surface2,
      }}
    >
      <Box
        data-testid="brewery-color"
        sx={{ width: 11, height: 11, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }}
      />
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
        {count} {plural(count, 'položka', 'položky', 'položek')}
      </Typography>
      <Box sx={{ flex: 1 }} />
      <ExpandMoreIcon
        sx={{
          fontSize: 20, color: 'text.secondary', transition: 'transform .18s',
          transform: open ? 'none' : 'rotate(-90deg)',
        }}
      />
    </ButtonBase>
  );
}

/** One labelled number of the Zdroj cluster. */
export interface NakladkaSourceEntry {
  label: string;
  value: number;
  adjust?: StepperAdjust;
}

/** Swatch per slot, by position: from the brewery, out of our stock, into our stock.
 *  Positional because that is what the caller's fixed-length array guarantees — the
 *  labels differ by two letters, so the colour is what tells the three lines apart at
 *  a glance. */
const SOURCE_SWATCH = ['primary.main', 'info.main', 'success.main'];

/**
 * Where a row's pieces come from: three labelled numbers on four shared tracks —
 * label, minus, value, plus.
 *
 * The two button tracks are reserved whether or not a line has a stepper, so every
 * number sits in one column down the whole cluster. "z pivovaru" has no stepper and
 * simply leaves its button cells empty, which is what keeps its number in line with the
 * two below it rather than trailing its own label.
 *
 * All three lines are always there, zero included: they are the row's own partition —
 * what the brewery hands over, what comes off our shelf instead, what we buy for the
 * shelf — and a line that appears only once it is non-zero makes the reader work out
 * which number is missing before the three can be read as a sum.
 *
 * Entries are nullable so the caller can leave a slot out and keep the colours of the
 * ones after it; today's caller fills all three.
 */
export function NakladkaSource({ entries }: { entries: Array<NakladkaSourceEntry | null> }) {
  return (
    <Box
      sx={{
        display: 'grid',
        ...stepperTracks({ value: 22, lead: 'max-content' }),
        alignItems: 'center',
        columnGap: 1,
        rowGap: 0.75,
        justifyContent: 'start',
        // Packed to the right edge of its cell on a phone, so the cluster sits under the
        // row total rather than floating in the middle of the row. The tighter gap is
        // what puts the numbers exactly under it — see `Total`.
        '@container nakladka (max-width: 500px)': { justifyContent: 'end', columnGap: 0.75 },
      }}
    >
      {entries.map((entry, index) => entry && (
        <SourceLine key={entry.label} entry={entry} swatch={SOURCE_SWATCH[index]} />
      ))}
    </Box>
  );
}

function SourceLine({ entry, swatch }: { entry: NakladkaSourceEntry; swatch?: string }) {
  const { label, value, adjust } = entry;

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
        {/* The colour, not the wording, is what separates the three lines in a glance —
            amber for the brewery, info for out of the garage, success for into it. */}
        <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: swatch, flexShrink: 0 }} />
        {/* Never wrapped: a label folded onto two lines makes its row taller than its
            neighbours and breaks the column of numbers this grid exists to keep straight. */}
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary', whiteSpace: 'nowrap' }}>{label}</Typography>
      </Box>
      {adjust ? (
        <StepperButton
          sign={-1}
          onClick={() => adjust.onAdjust(-1)}
          disabled={!adjust.canDecrease}
          label={adjust.decreaseLabel}
        />
      ) : <span />}
      <Typography
        sx={{
          fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'center',
          color: value > 0 ? 'text.primary' : 'text.disabled',
        }}
      >
        {value}
      </Typography>
      {adjust ? (
        <StepperButton
          sign={1}
          onClick={() => adjust.onAdjust(1)}
          disabled={!adjust.canIncrease}
          label={adjust.increaseLabel}
        />
      ) : <span />}
    </>
  );
}
