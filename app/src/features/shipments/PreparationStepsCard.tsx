// The checklist on the shipment detail: tick-only. The list itself is written in the editor
// (PreparationStepsEditor), so there is deliberately no add/rename/reorder here — the dispatcher
// works down the boxes while packing the van.

import { Card, Checkbox, Chip, Stack, Typography } from '@mui/material';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import { type OutgoingShipmentPreparationStepDto } from 'src/generated/api-client';
import { StatusPill } from 'src/components/common/StatusPill';

export function PreparationStepsCard({
  steps,
  editable,
  onToggle,
}: {
  steps: OutgoingShipmentPreparationStepDto[];
  editable: boolean;
  onToggle: (stepId: string, isDone: boolean) => void;
}) {
  // Nothing to show and nothing to add from here — an empty card would only be a dead end
  // pointing at the editor, so it stays out of the column entirely.
  if (steps.length === 0) return null;

  const ordered = steps.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const doneCount = ordered.filter((s) => s.isDone).length;
  const allDone = doneCount === ordered.length;

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
        <ChecklistOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Checklist</Typography>
        {allDone
          ? <StatusPill tone="ok" label="Hotovo" />
          : <Chip size="small" label={`${doneCount}/${ordered.length}`} sx={{ fontWeight: 700 }} />}
      </Stack>

      <Stack sx={{ px: 1.5, py: 1 }}>
        {ordered.map((step) => (
          <Stack key={step.id} direction="row" alignItems="center" spacing={0.5}>
            <Checkbox
              size="small"
              checked={Boolean(step.isDone)}
              disabled={!editable}
              onChange={(e) => onToggle(step.id ?? '', e.target.checked)}
              // The label is a sibling rather than a FormControlLabel wrapper so a long step
              // can wrap without dragging the box off the first line.
              inputProps={{ 'aria-label': step.label ?? '' }}
            />
            <Typography
              sx={{
                fontSize: 13.5,
                color: step.isDone ? 'text.disabled' : 'text.primary',
                textDecoration: step.isDone ? 'line-through' : 'none',
              }}
            >
              {step.label}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
