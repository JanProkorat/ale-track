import { Fragment, type ReactNode } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeftOutlined';

/** Header for an entity detail screen: a back control, the entity's identity and
 * state on one row, then a single dot-separated meta line.
 *
 * Deliberate deviation from the prototype's `.page-head`, which stacked an
 * eyebrow, an `h1` and a `sub` line beneath a breadcrumb. Three of those
 * restated each other — the eyebrow repeated the breadcrumb's module, the
 * trailing crumb repeated the title — and the screens had since grown extra meta
 * rows, leaving six lines of chrome above the content.
 *
 * The back arrow replaces the breadcrumb because navigation was the crumb's only
 * real job: its module link was the sole in-app route back to the list. On a
 * phone the sidebar is now a hidden drawer, so `backLabel` is also the only
 * remaining cue for which module you are in — always give it a real sentence. */
export function DetailHeader({
  onBack,
  backLabel,
  title,
  titleMono = false,
  lead,
  leadMono = false,
  status,
  meta = [],
  actions,
}: {
  onBack: () => void;
  /** Tooltip and accessible name for the back arrow, e.g. "Zpět na objednávky". */
  backLabel: string;
  title: ReactNode;
  /** Monospace the title — for display numbers rather than names. */
  titleMono?: boolean;
  /** Secondary identity beside the title: the client on an order, the number on
   * a shipment whose title is its name. */
  lead?: ReactNode;
  leadMono?: boolean;
  status?: ReactNode;
  /** Dot-separated meta line. Falsy entries are dropped, so callers can inline
   * conditionals without leaving stray separators. */
  meta?: ReactNode[];
  actions?: ReactNode;
}) {
  const items = meta.filter(Boolean);

  return (
    <Stack
      data-testid="detail-header"
      direction="row"
      spacing={1.25}
      alignItems="flex-start"
      flexWrap="wrap"
      useFlexGap
      sx={{ mb: 3 }}
    >
      <Tooltip title={backLabel}>
        <IconButton
          onClick={onBack}
          aria-label={backLabel}
          size="small"
          // Nudged up and left so the arrow optically aligns with the title's
          // cap height and the page's left edge, not the icon's bounding box.
          sx={{ mt: '1px', ml: -0.75, flexShrink: 0 }}
        >
          <ChevronLeftIcon />
        </IconButton>
      </Tooltip>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          alignItems="baseline"
          spacing={1.5}
          flexWrap="wrap"
          useFlexGap
          sx={{ rowGap: 0.5 }}
        >
          <Typography
            variant="h1"
            sx={{ fontSize: { xs: 21, compact: 26 }, ...(titleMono && { fontFamily: 'monospace' }) }}
          >
            {title}
          </Typography>
          {lead && (
            <Typography
              sx={{
                fontSize: { xs: 15, compact: 18 },
                fontWeight: 700,
                color: 'primary.dark',
                minWidth: 0,
                ...(leadMono && { fontFamily: 'monospace' }),
              }}
              noWrap
            >
              {lead}
            </Typography>
          )}
          {/* Baseline alignment would hang a pill off the text baseline. */}
          {status && <Box sx={{ alignSelf: 'center', display: 'flex' }}>{status}</Box>}
        </Stack>

        {items.length > 0 && (
          <Stack
            direction="row"
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ mt: 0.5, columnGap: 1, rowGap: 0.25, color: 'text.secondary', fontSize: 13.5 }}
          >
            {items.map((item, i) => (
              <Fragment key={i}>
                {i > 0 && (
                  <Box component="span" sx={{ opacity: 0.45 }} aria-hidden>
                    ·
                  </Box>
                )}
                <Box
                  component="span"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}
                >
                  {item}
                </Box>
              </Fragment>
            ))}
          </Stack>
        )}
      </Box>

      {actions && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{
            flexShrink: 0,
            // Own full-width row on a phone, stretching to fill it, as PageHeader does.
            width: { xs: '100%', compact: 'auto' },
            '& > *': { flex: { xs: '1 1 auto', compact: '0 0 auto' } },
          }}
        >
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
