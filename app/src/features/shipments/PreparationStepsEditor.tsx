// The checklist as written in the shipment editor: notes of what to check before the van leaves.
// The detail screen ticks these off (PreparationStepsCard); this side only defines them, which is
// why a row carries no done flag here.

import { useState } from 'react';
import {
  Box, Card, Chip, IconButton, Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { EmptyState } from 'src/components/common/EmptyState';
import { newDraftStep, STEP_LABEL_MAX, type DraftStep } from './preparationStepModel';

export function PreparationStepsEditor({
  steps,
  onChange,
  disabled,
}: {
  steps: DraftStep[];
  onChange: (next: DraftStep[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');

  function add() {
    const label = draft.trim();
    if (!label) return;
    onChange([...steps, newDraftStep(label)]);
    setDraft('');
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
        <ChecklistOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Checklist</Typography>
        {steps.length > 0 && <Chip size="small" label={steps.length} />}
      </Stack>

      <Stack spacing={1} sx={{ p: 2 }}>
        {steps.length === 0 ? (
          <EmptyState title="Zatím žádné položky" description="Zapište, co zkontrolovat před odjezdem. Odškrtávat se budou v detailu vývozu." dense />
        ) : steps.map((step, i) => (
          <Stack key={step.key} direction="row" alignItems="center" spacing={0.5}>
            <Stack sx={{ flexShrink: 0 }}>
              <IconButton size="small" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label="Posunout nahoru" sx={{ p: 0.25 }}>
                <ArrowUpwardIcon sx={{ fontSize: 14 }} />
              </IconButton>
              <IconButton size="small" disabled={disabled || i === steps.length - 1} onClick={() => move(i, 1)} aria-label="Posunout dolů" sx={{ p: 0.25 }}>
                <ArrowDownwardIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Stack>
            {/* No visible label: these are notes to check off, and a floating "Krok N" above
                every row buried the note itself. The accessible name stays, for the same reason
                the icon buttons carry one. */}
            <TextField
              size="small"
              fullWidth
              value={step.label}
              disabled={disabled}
              onChange={(e) => onChange(steps.map((s) => (s.key === step.key ? { ...s, label: e.target.value } : s)))}
              slotProps={{ htmlInput: { maxLength: STEP_LABEL_MAX, 'aria-label': `Položka ${i + 1}` } }}
            />
            <IconButton
              size="small"
              disabled={disabled}
              onClick={() => onChange(steps.filter((s) => s.key !== step.key))}
              aria-label={`Odebrat položku ${i + 1}`}
              sx={{ flexShrink: 0 }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', pt: steps.length > 0 ? 0.5 : 0 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Nová položka…"
            value={draft}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            // Enter adds without reaching for the button, the way the list is actually written —
            // and stops the keypress from submitting anything up the tree.
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            slotProps={{ htmlInput: { maxLength: STEP_LABEL_MAX } }}
          />
          {/* No Tooltip: it would expose a second accessible name identical to the aria-label,
              which makes the button ambiguous to a screen reader (and to a by-label query). */}
          <IconButton size="small" color="primary" disabled={disabled || draft.trim() === ''} onClick={add} aria-label="Přidat položku">
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>
      </Stack>
    </Card>
  );
}
