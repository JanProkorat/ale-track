import { useId, useState, type ReactNode } from 'react';
import { Box, ButtonBase, Card, Collapse, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined';

/** Card with the prototype's header band, collapsible by clicking the title.
 *
 * Only the title area is a button. `action` renders as its sibling rather than
 * inside it, because these headers carry real controls (Zboží na sklad, Faktura
 * pivovaru, Přidat…) and a button nested in a button is invalid HTML — the inner
 * one stops receiving its own clicks.
 *
 * The body is rendered exactly as given, with no padding of its own: some cards
 * hold a padded block, others a full-bleed list or table that must reach the card
 * edges. Callers keep whatever wrapper they already had. */
export function CollapsibleCard({
  title,
  icon,
  count,
  action,
  children,
  defaultExpanded = true,
  sx,
}: {
  title: ReactNode;
  icon?: ReactNode;
  /** Count pill beside the title. Stays visible while collapsed, so the header
   * says how much is inside without expanding it. */
  count?: number;
  /** Header controls. Kept outside the clickable title so they stay clickable. */
  action?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  sx?: object;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const bodyId = useId();

  return (
    <Card sx={{ overflow: 'hidden', ...sx }}>
      <Stack
        direction="row"
        alignItems="center"
        // Collapsed, the band's rule would sit under nothing — drop it with the body.
        sx={{ borderBottom: expanded ? 1 : 0, borderColor: 'divider' }}
      >
        <ButtonBase
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          sx={{
            flex: 1,
            minWidth: 0,
            gap: 1,
            px: 2.5,
            py: 1.75,
            justifyContent: 'flex-start',
            textAlign: 'left',
          }}
        >
          {icon}
          <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1, minWidth: 0 }}>
            {title}
          </Typography>
          {count !== undefined && (
            <Box
              component="span"
              sx={{
                px: 1, py: 0.25, borderRadius: 999, bgcolor: 'action.selected',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}
            >
              {count}
            </Box>
          )}
          <ExpandMoreIcon
            sx={{
              flexShrink: 0,
              color: 'text.secondary',
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform .2s',
            }}
          />
        </ButtonBase>
        {action && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 2.5, flexShrink: 0 }}>
            {action}
          </Box>
        )}
      </Stack>
      <Collapse in={expanded} id={bodyId}>
        {children}
      </Collapse>
    </Card>
  );
}
